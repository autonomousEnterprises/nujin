import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import bs58 from 'bs58';

export async function createSolanaWallet() {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const privateKey = bs58.encode(keypair.secretKey);
    return {
        publicKey,
        privateKey,
        message: `Successfully created a new Solana wallet. Address: ${publicKey}`
    };
}

export async function getSolanaBalance(address: string, network: 'mainnet-beta' | 'devnet' | 'testnet' = 'devnet') {
    try {
        const clusterUrl = `https://api.${network}.solana.com`;
        const connection = new Connection(clusterUrl, 'confirmed');
        const pubKey = new PublicKey(address);
        const balance = await connection.getBalance(pubKey);
        const solBalance = balance / LAMPORTS_PER_SOL;
        return {
            balance: solBalance,
            message: `Wallet ${address} has a balance of ${solBalance} SOL on ${network}.`
        };
    } catch (error: any) {
        throw new Error(`Failed to get balance: ${error.message}`);
    }
}

export async function requestSolanaAirdrop(address: string, amountSol: number = 1, network: 'mainnet-beta' | 'devnet' | 'testnet' = 'devnet') {
    if (network === 'mainnet-beta') {
        throw new Error("Airdrops are not available on mainnet-beta.");
    }
    try {
        // Devnet and testnet limits usually cap request amounts. Using 1 by default.
        const clusterUrl = `https://api.${network}.solana.com`;
        const connection = new Connection(clusterUrl, 'confirmed');
        const pubKey = new PublicKey(address);
        
        const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
        const signature = await connection.requestAirdrop(pubKey, lamports);
        
        const latestBlockHash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature,
        });

        return {
            signature,
            message: `Successfully requested airdrop of ${amountSol} SOL to ${address} on ${network}. Tx signature: ${signature}`
        };
    } catch (error: any) {
        throw new Error(`Failed to request airdrop: ${error.message}`);
    }
}

export async function sendSolana(fromPrivateKeyBase58: string, toAddress: string, amountSol: number, network: 'mainnet-beta' | 'devnet' | 'testnet' = 'devnet') {
    try {
        const clusterUrl = `https://api.${network}.solana.com`;
        const connection = new Connection(clusterUrl, 'confirmed');
        
        const secretKey = bs58.decode(fromPrivateKeyBase58);
        const fromKeypair = Keypair.fromSecretKey(secretKey);
        const toPubKey = new PublicKey(toAddress);
        
        const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
        
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromKeypair.publicKey,
                toPubkey: toPubKey,
                lamports: lamports,
            })
        );
        
        const signature = await connection.sendTransaction(transaction, [fromKeypair]);
        const latestBlockHash = await connection.getLatestBlockhash();
        
        await connection.confirmTransaction({
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature,
        });
        
        return {
            signature,
            message: `Successfully sent ${amountSol} SOL to ${toAddress} on ${network}. Tx signature: ${signature}`
        };
    } catch (error: any) {
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
}

export async function executeSolanaProgram(
    privateKeyBase58: string, 
    programIdStr: string, 
    accounts: { pubkey: string, isSigner: boolean, isWritable: boolean }[], 
    dataBase58: string, 
    network: 'mainnet-beta' | 'devnet' | 'testnet' = 'devnet'
) {
    try {
        const clusterUrl = `https://api.${network}.solana.com`;
        const connection = new Connection(clusterUrl, 'confirmed');
        
        const secretKey = bs58.decode(privateKeyBase58);
        const feePayerKeypair = Keypair.fromSecretKey(secretKey);
        
        const programId = new PublicKey(programIdStr);
        const data = Buffer.from(bs58.decode(dataBase58));
        
        const keys = accounts.map(acc => ({
            pubkey: new PublicKey(acc.pubkey),
            isSigner: acc.isSigner,
            isWritable: acc.isWritable
        }));

        const instruction = new TransactionInstruction({
            keys,
            programId,
            data
        });

        const transaction = new Transaction().add(instruction);
        
        const signature = await connection.sendTransaction(transaction, [feePayerKeypair]);
        const latestBlockHash = await connection.getLatestBlockhash();
        
        await connection.confirmTransaction({
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature,
        });

        return {
            signature,
            message: `Successfully executed instruction for program ${programIdStr} on ${network}. Tx signature: ${signature}`
        };
    } catch (error: any) {
        throw new Error(`Failed to execute program: ${error.message}`);
    }
}
