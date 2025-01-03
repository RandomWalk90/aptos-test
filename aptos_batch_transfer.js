// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


const { Aptos, Ed25519PrivateKey, AptosConfig, Account, Network } = require("@aptos-labs/ts-sdk");
const fs = require('fs').promises;
require('dotenv').config();

// 配置多个 API 节点
const API_ENDPOINTS = [
    'https://api.mainnet.aptoslabs.com/v1',
]

// 创建多个客户端实例
const clients = API_ENDPOINTS.map(url => new Aptos(new AptosConfig({ network: Network.MAINNET })));
let currentClientIndex = 0;
// Set up the client
const aptosConfig = new AptosConfig({ network: Network.MAINNET });
const aptos = new Aptos(aptosConfig);


// 获取当前可用的客户端
function getCurrentClient() {
    return clients[currentClientIndex];
}

// 切换到下一个客户端
function switchToNextClient() {
    currentClientIndex = (currentClientIndex + 1) % clients.length;
    console.log(`切换到下一个 API 节点: ${API_ENDPOINTS[currentClientIndex]}`);
    return getCurrentClient();
}

// 添加重试机制的包装函数
async function withRetry(operation, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation(getCurrentClient());
        } catch (error) {
            console.error(`尝试失败 (${i + 1}/${maxRetries}):`, error.message);
            if (i < maxRetries - 1) {
                switchToNextClient();
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 递增等待时间
            } else {
                throw error;
            }
        }
    }
}


async function batchTransfer(senderPrivateKey, amount) {
    const keyFilePath = process.env.KEY_FILE_PATH;
    if (!keyFilePath) {
        throw new Error('未设置 KEY_FILE_PATH 环境变量');
    }

    try {
        // 创建发送者账户
        const privateKeyBytes = Buffer.from(senderPrivateKey, 'hex');
        const privateKey = new Ed25519PrivateKey(privateKeyBytes);
        const account = Account.fromPrivateKey({ privateKey });

        // 从文件读取接收地址
        const fileContent = await fs.readFile(keyFilePath, 'utf8');
        const recipientAddresses = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => line.split(',')[1])
            .filter(address => address && address.length === 66);

        if (recipientAddresses.length === 0) {
            throw new Error('没有找到有效的接收地址');
        }
        console.log(`senderAddress: ${account.accountAddress}`);
        console.log(`找到 ${recipientAddresses.length} 个接收地址`);

        // 使用重试机制检查余额
        // const resources = await withRetry(async (client) => 
        //     await client.getAccountResources(account.accountAddress)
        // );
        const fund = await aptos.getAccountResource({
            accountAddress: account.accountAddress,
            resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
        });

        console.log(`fund: ${fund.coin.value}`);
        // const accountResource = resources.find((r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
        const balance = BigInt(fund.coin.value);
        const balanceInApt = Number(balance) / 100000000;
        console.log(`当前余额: ${balanceInApt} APT`);

        const totalAmount = amount * recipientAddresses.length;
        if (balanceInApt < totalAmount) {
            throw new Error(`余额不足，需要 ${totalAmount} APT，当前只有 ${balanceInApt} APT`);
        }

        // 批量转账
        for (let i = 0; i < recipientAddresses.length; i++) {
            const recipientAddress = recipientAddresses[i];
            try {
                await withRetry(async (client) => {

                    const transaction = await aptos.transaction.build.simple({
                        sender: account.accountAddress,
                        withFeePayer: true,
                        data: {
                            function: "0x1::aptos_account::transfer",
                            functionArguments: [recipientAddress, (amount * 100000000).toString()],
                        },
                    });

                    const senderSignature = aptos.transaction.sign({ signer: account, transaction });
                    const sponsorSignature = aptos.transaction.signAsFeePayer({ signer: account, transaction });

                    const committedTxn = await aptos.transaction.submit.simple({
                        transaction,
                        senderAuthenticator: senderSignature,
                        feePayerAuthenticator: sponsorSignature,
                    });

                    console.log(`Submitted transaction: ${committedTxn.hash}`);
                    const response = await aptos.waitForTransaction({ transactionHash: committedTxn.hash });

                    console.log("\n=== Balances after transfer ===\n");

                    console.log(`成功转账 ${amount} APT 到 ${recipientAddress}`);
                    console.log(`交易哈希: ${committedTxn.hash}`);

                    // await fs.appendFile(
                    //     'transfer_log.txt',
                    //     `${new Date().toISOString()},${sender.address()},${recipientAddress},${amount},${tx.hash}\n`
                    // );
                });

            } catch (error) {
                console.error(`转账到 ${recipientAddress} 失败:`, error);
                continue;
            }

            await new Promise(resolve => setTimeout(resolve, 2000)); // 增加等待时间
        }

        // 检查最终余额
        const finalFund = await aptos.getAccountResource({
            accountAddress: account.accountAddress,
            resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
        });

        console.log(`转账完成，剩余余额 finalFund: ${finalFund.coin.value}`);
        // console.log(`转账完成，剩余余额: ${balanceInApt} APT`);

    } catch (error) {
        console.error('批量转账过程中发生错误:', error);
        throw error;
    }
}

async function main() {
    try {
        const senderPrivateKey = process.argv[2];
        const amount = parseFloat(process.argv[3]);

        if (!senderPrivateKey || !amount) {
            throw new Error('请提供发送者私钥和转账金额作为命令行参数');
        }

        console.log(`每个地址将收到 ${amount} APT`);
        console.log('开始转账...');

        await batchTransfer(senderPrivateKey, amount);

    } catch (error) {
        console.error('程序执行错误:', error);
        process.exit(1);
    }
}

main(); 