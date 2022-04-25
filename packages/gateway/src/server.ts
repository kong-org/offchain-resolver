import { Server } from '@chainlink/ccip-read-server';
import { ethers, BytesLike } from 'ethers';
import { hexConcat, Result } from 'ethers/lib/utils';
// import { ETH_COIN_TYPE } from './utils';
// import { abi as IResolverService_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/IResolverService.json';
// import { abi as Resolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json';
// import { Provider } from '@ethersproject/abstract-provider';
import Resolver_abi from './L2KongResolverABI';
const Resolver = new ethers.utils.Interface(Resolver_abi);

// TODO: copy this over from the relevant place
const IResolverService_abi = ["function resolve(bytes calldata data) external view returns(bytes memory result, uint64 expires, bytes memory sig)"];

// console.log('Resolve sighash:', (new ethers.utils.Interface(IResolverService_abi)).getSighash('resolve'));

type PromiseOrResult<T> = T | Promise<T>;

export interface Database {
  addr(
    name: string,
    coinType: number
  ): PromiseOrResult<{ addr: string; ttl: number }>;
  text(
    name: string,
    key: string
  ): PromiseOrResult<{ value: string; ttl: number }>;
}

const queryHandlers: {
  [key: string]: (
    l2Resolver: ethers.Contract,
    args: Result
  ) => Promise<any>;
} = {
  'manufacturer(bytes32)': async (l2Resolver, args) => {
    // console.log('result', await l2Resolver.manufacturer(args[0]));
    return [await l2Resolver.manufacturer(args[0])];
  },
  'ellipticCurve(bytes32)': async (l2Resolver, args) => {
    return [await l2Resolver.ellipticCurve(args[0])];
  },
  'tsm(bytes32)': async (l2Resolver, args) => {
    return [await l2Resolver.tsm(args[0])];
  },
};

async function query(
  l2Resolver: ethers.Contract,
  data: string
): Promise<{ result: BytesLike; validUntil: number }> {
  // Parse the data nested inside the second argument to `resolve`
  const { signature, args } = Resolver.parseTransaction({ data });

  const handler = queryHandlers[signature];
  if (handler === undefined) {
    throw new Error(`Unsupported query function ${signature}`);
  }

  const startingBlockNumber = await l2Resolver.provider.getBlockNumber();
  const result = await handler(l2Resolver, args);
  const endingBlockNumber = await l2Resolver.provider.getBlockNumber();
  if (startingBlockNumber !== endingBlockNumber) throw Error("Can't guarantee L2 result is from the right block");

  const validUntil = (await l2Resolver.provider.getBlock(startingBlockNumber)).timestamp;

  return {
    result: Resolver.encodeFunctionResult(signature, result),
    validUntil
  };
}

export function makeServer(signer: ethers.utils.SigningKey, l2Resolver: ethers.Contract) {
  const server = new Server();
  server.add(IResolverService_abi, [
    {
      type: 'resolve',
      func: async ([data]: Result, request) => {
        console.log('Called resolve() with data', data);
        // Query the L2
        const { result, validUntil } = await query(l2Resolver, data);

        // Hash and sign the response
        let messageHash = ethers.utils.solidityKeccak256(
          ['bytes', 'address', 'uint64', 'bytes32', 'bytes32'],
          [
            '0x1900',
            request?.to,
            validUntil,
            ethers.utils.keccak256(request?.data || '0x'),
            ethers.utils.keccak256(result),
          ]
        );
        const sig = signer.signDigest(messageHash);
        const sigData = hexConcat([sig.r, sig._vs]);
        return [result, validUntil, sigData];
      },
    },
  ]);
  return server;
}

export function makeApp(
  signer: ethers.utils.SigningKey,
  path: string,
  resolver: ethers.Contract
) {
  return makeServer(signer, resolver).makeApp(path);
}
