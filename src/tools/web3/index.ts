import type { BuiltinTool } from '../types.js';
import { createSolanaWallet, getSolanaBalance, requestSolanaAirdrop, sendSolana, executeSolanaProgram } from './solana.js';
import { saveWallet, getWallets } from '../../services/db.js';

export const web3Tool: BuiltinTool = {
    name: 'web3',
    description: 'Perform Web3 operations, programmatically interacting with blockchains. Currently supports Solana.',
    parameters: {
        type: 'object',
        properties: {
            blockchain: { 
                type: 'string', 
                description: 'The blockchain to interact with. Currently only "solana" is supported.',
                enum: ['solana']
            },
            action: {
                type: 'string',
                description: 'The action to perform. Valid actions: "create_wallet", "get_balance", "request_airdrop", "send_tokens", "execute_program", "list_wallets".',
                enum: ['create_wallet', 'get_balance', 'request_airdrop', 'send_tokens', 'execute_program', 'list_wallets']
            },
            network: {
                type: 'string',
                description: 'The network to use. e.g. "devnet", "testnet", "mainnet-beta". Defaults to "devnet".',
                enum: ['mainnet-beta', 'devnet', 'testnet']
            },
            address: {
                type: 'string',
                description: 'The public address to query balance for, or target address to request airdrops/'
            },
            to_address: {
                type: 'string',
                description: 'The destination address when sending tokens.'
            },
            amount: {
                type: 'number',
                description: 'The amount of tokens to send or request airdrop for (in native token decimals, e.g., 1.5 SOL).'
            },
            private_key: {
                type: 'string',
                description: 'The base58 encoded private key required for signing transactions when sending tokens or executing a smart contract program.'
            },
            program_id: {
                type: 'string',
                description: 'The program ID (address) of the smart contract to execute. Required for "execute_program".'
            },
            program_accounts: {
                type: 'array',
                description: 'An array of accounts involved in the smart contract execution. Structured as objects with { pubkey: string, isSigner: boolean, isWritable: boolean }.',
                items: {
                    type: 'object',
                    properties: {
                        pubkey: { type: 'string' },
                        isSigner: { type: 'boolean' },
                        isWritable: { type: 'boolean' }
                    },
                    required: ['pubkey', 'isSigner', 'isWritable']
                }
            },
            program_data: {
                type: 'string',
                description: 'The Base58 encoded data payload (instruction) to send to the smart contract. Required for "execute_program".'
            }
        },
        required: ['blockchain', 'action'],
    },
    execute: async (args: any, context?: any) => {
        try {
            const { chatId } = context || {};
            if (!chatId) {
                return 'Error: Missing chatId context. Cannot perform secure wallet operations without knowing the current chat session.';
            }

            const { blockchain, action, network = 'devnet', address, to_address, amount, private_key } = args;

            if (blockchain !== 'solana') {
                return `Unsupported blockchain: ${blockchain}. Currently only "solana" is supported.`;
            }

            switch (action) {
                case 'create_wallet':
                    const wallet = await createSolanaWallet();
                    // Save to Supabase automatically so the bot remembers
                    await saveWallet({
                        chat_id: chatId,
                        blockchain: 'solana',
                        public_address: wallet.publicKey,
                        private_key: wallet.privateKey
                    });
                    // Provide the user with the public and private key.
                    // IMPORTANT: The AI must present this securely or warn the user.
                    return JSON.stringify(wallet, null, 2);

                case 'list_wallets':
                    const wallets = await getWallets(chatId, 'solana');
                    if (wallets && wallets.length > 0) {
                        return JSON.stringify(wallets, null, 2);
                    }
                    return "No wallets found for Solana in the database. Please create one.";

                case 'get_balance':
                    if (!address) return 'Missing required parameter: "address"';
                    const balanceResult = await getSolanaBalance(address, network);
                    return JSON.stringify(balanceResult, null, 2);

                case 'request_airdrop':
                    if (!address) return 'Missing required parameter: "address"';
                    const airdropAmount = amount || 1;
                    const airdropResult = await requestSolanaAirdrop(address, airdropAmount, network);
                    return JSON.stringify(airdropResult, null, 2);

                case 'send_tokens':
                    if (!private_key) return 'Missing required parameter: "private_key"';
                    if (!to_address) return 'Missing required parameter: "to_address"';
                    if (!amount) return 'Missing required parameter: "amount"';
                    
                    const sendResult = await sendSolana(private_key, to_address, amount, network);
                    return JSON.stringify(sendResult, null, 2);

                case 'execute_program':
                    if (!private_key) return 'Missing required parameter: "private_key"';
                    // We destructure specifically the new program related args
                    const { program_id, program_accounts, program_data } = args;
                    if (!program_id) return 'Missing required parameter: "program_id"';
                    if (!program_accounts) return 'Missing required parameter: "program_accounts" (expected array)';
                    if (!program_data) return 'Missing required parameter: "program_data" (expected base58 encoded string)';
                    
                    const execResult = await executeSolanaProgram(private_key, program_id, program_accounts, program_data, network);
                    return JSON.stringify(execResult, null, 2);

                default:
                    return `Unsupported action: ${action}. Valid actions are "create_wallet", "get_balance", "request_airdrop", "send_tokens", "execute_program", "list_wallets".`;
            }
        } catch (e: any) {
            return `Web3 action failed: ${e.message}`;
        }
    },
};
