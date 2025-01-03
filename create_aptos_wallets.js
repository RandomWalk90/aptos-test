const { AptosAccount } = require('aptos');
const fs = require('fs').promises;
require('dotenv').config();

async function createAptosWallets(count) {
    try {
        // 获取存储私钥的文件路径
        const keyFilePath = process.env.KEY_FILE_PATH;
        if (!keyFilePath) {
            throw new Error('未设置 KEY_FILE_PATH 环境变量');
        }

        console.log(`开始创建 ${count} 个 Aptos 钱包...`);

        // 创建指定数量的钱包
        for (let i = 0; i < count; i++) {
            // 创建新账户
            const account = new AptosAccount();
            
            // 获取私钥（转换为十六进制字符串）
            const privateKey = Buffer.from(account.signingKey.secretKey)
                .toString('hex')
                .slice(0, 64); // 只取前64个字符，因为后32字节是公钥

            // 获取地址
            const address = account.address().toString();

            // 将私钥和地址写入文件
            const walletInfo = `${privateKey},${address}\n`;
            await fs.appendFile(keyFilePath, walletInfo);

            console.log(`已创建第 ${i + 1} 个钱包：${address}`);
        }

        console.log('所有钱包创建完成！');
        console.log(`钱包信息已保存到：${keyFilePath}`);

    } catch (error) {
        console.error('创建钱包时发生错误：', error);
    }
}


// 设置要创建的钱包数量
const WALLET_COUNT = process.env.WALLET_COUNT || 10; // 可以根据需要修改数量

// 运行函数
createAptosWallets(WALLET_COUNT); 