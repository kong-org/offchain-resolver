import { makeApp } from './server';
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { ethers } from 'ethers';
import ResolverABI from './L2KongResolverABI';
const program = new Command();
program
  .requiredOption(
    '-k --private-key <key>',
    'Private key to sign responses with. Prefix with @ to read from a file'
  )
  .requiredOption('-r --rpc <url>', 'RPC endpoint to query for L2 state')
  .requiredOption('-a --resolver-address <string>', 'L2 resolver address')
  .option('-t --ttl <number>', 'TTL for signatures', '300')
  .option('-p --port <number>', 'Port number to serve on', '8080');
program.parse(process.argv);
const options = program.opts();
let privateKey = options.privateKey;
if (privateKey.startsWith('@')) {
  privateKey = ethers.utils.arrayify(
    readFileSync(privateKey.slice(1), { encoding: 'utf-8' })
  );
}
const address = ethers.utils.computeAddress(privateKey);
const signer = new ethers.utils.SigningKey(privateKey);
const provider = new ethers.providers.JsonRpcProvider(options.rpc);
const resolver = new ethers.Contract(options.resolverAddress, ResolverABI, provider);
const app = makeApp(signer, '/', resolver);
console.log(`Serving on port ${options.port} with signing address ${address}`);
app.listen(parseInt(options.port));

module.exports = app;
