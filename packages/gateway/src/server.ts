import { Server } from '@chainlink/ccip-read-server';
import { ethers, BytesLike } from 'ethers';
import { hexConcat, Result } from 'ethers/lib/utils';
// import { ETH_COIN_TYPE } from './utils';
// import { abi as IResolverService_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/IResolverService.json';
// import { abi as Resolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json';
// import { Provider } from '@ethersproject/abstract-provider';
import Resolver_abi from './L2KongResolverABI';
const Resolver = new ethers.utils.Interface(Resolver_abi);

const IResolverService_abi = ["function resolve(bytes32 chipId, bytes calldata data)"];

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
    resolver: ethers.Contract,
    chipId: string,
    args: Result
  ) => Promise<any>;
} = {
  'manufacturer(bytes32)': async (resolver, chipId, args) => {
    return await resolver.manufacturer(args[0]);
  },
  'ellipticCurve(bytes32)': async (resolver, chipId, args) => {
    return await resolver.ellipticCurve(args[0]);
  },
  'tsm(bytes32)': async (resolver, chipId, args) => {
    return await resolver.tsm(args[0]);
  },
};

async function query(
  resolver: ethers.Contract,
  chipId: string,
  data: string
): Promise<{ result: BytesLike; validFrom: number }> {
  // Parse the data nested inside the second argument to `resolve`
  const { signature, args } = Resolver.parseTransaction({ data });

  const handler = queryHandlers[signature];
  if (handler === undefined) {
    throw new Error(`Unsupported query function ${signature}`);
  }

  const startingBlockNumber = await resolver.provider.getBlockNumber();
  const result = await handler(resolver, chipId, args.slice(1));
  const endingBlockNumber = await resolver.provider.getBlockNumber();
  if (startingBlockNumber !== endingBlockNumber) throw Error("Can't guarantee L2 result is from the right block");
  const validFrom = (await resolver.provider.getBlock(startingBlockNumber)).timestamp;

  return {
    result: Resolver.encodeFunctionResult(signature, result),
    validFrom
  };
}

export function makeServer(signer: ethers.utils.SigningKey, resolver: ethers.Contract) {
  const server = new Server();
  server.add(IResolverService_abi, [
    {
      type: 'resolve',
      func: async ([chipId, data]: Result, request) => {
        // Query the L2
        const { result, validFrom } = await query(resolver, chipId, data);

        // Hash and sign the response
        let messageHash = ethers.utils.solidityKeccak256(
          ['bytes', 'address', 'uint32', 'bytes32', 'bytes32'],
          [
            '0x1900',
            request?.to,
            validFrom,
            ethers.utils.keccak256(request?.data || '0x'),
            ethers.utils.keccak256(result),
          ]
        );
        const sig = signer.signDigest(messageHash);
        const sigData = hexConcat([sig.r, sig._vs]);
        return [result, validFrom, sigData];
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
