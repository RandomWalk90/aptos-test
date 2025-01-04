const { Aptos, Ed25519PrivateKey, AptosConfig, Account, Network } = require("@aptos-labs/ts-sdk");
const fs = require('fs').promises;
require('dotenv').config();

const aptos = new Aptos(new AptosConfig({ network: Network.MAINNET }));

async function depositEntry(privateKey, amount) {
    try {
        // 创建发送者账户
        const privateKeyBytes = Buffer.from(privateKey, 'hex');
        const ed25519PrivateKey = new Ed25519PrivateKey(privateKeyBytes);
        const account = Account.fromPrivateKey({ privateKey: ed25519PrivateKey });

        console.log(`发送者地址: ${account.accountAddress}`);

        const fund = await aptos.getAccountResource({
            accountAddress: account.accountAddress,
            resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
        });

        console.log(`fund: ${fund.coin.value}`);
        const balance = BigInt(fund.coin.value);
        const balanceInApt = Number(balance) / 100000000;
        console.log(`当前余额: ${balanceInApt} APT`);

        // 调用 deposit_entry 方法
        const transaction = await aptos.transaction.build.simple({
            sender: account.accountAddress,
            withFeePayer: true,
            data: {
                function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::deposit_and_stake_entry",
                functionArguments: [
                    (amount*100000000).toString(), // 传入存款金额
                    account.accountAddress,
                ]
            }
        });

        // 签名并提交交易
        const senderSignature = await aptos.transaction.sign({ signer: account, transaction });
        const sponsorSignature = aptos.transaction.signAsFeePayer({ signer: account, transaction });
        const committedTxn = await aptos.transaction.submit.simple({ 
            transaction,
            senderAuthenticator: senderSignature,
            feePayerAuthenticator: sponsorSignature,});

        // 等待交易确认
        const response = await aptos.waitForTransaction({ transactionHash: committedTxn.hash });
        console.log(`成功存款 ${amount} APT 到 ${account.accountAddress}`);
        console.log(`交易哈希: ${committedTxn.hash}`);

    } catch (error) {
        console.error('存款过程中发生错误:', error);
    }
}

async function main() {
    try {
        const keyFilePath = process.env.KEY_FILE_PATH;

        if (!keyFilePath) {
            throw new Error('未设置 KEY_FILE_PATH 环境变量');
        }

        // 从文件读取私钥
        const fileContent = await fs.readFile(keyFilePath, 'utf8');
        const privateKeys = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => line.split(',')[0]); // 获取逗号前的私钥部分
        for (let i = 0; i < privateKeys.length; i++) {
            const amount = (1.01 + i * 0.01).toFixed(2); // 设置存款金额
            const privateKey = privateKeys[i];
            await depositEntry(privateKey, amount);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待一段时间再进行下一次存款
        }

    } catch (error) {
        console.error('程序执行错误:', error);
        process.exit(1);
    }
}

main();
