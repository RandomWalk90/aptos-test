## GET START

```
npm install
// 先创建 .env 文件 内容如下
KEY_FILE_PATH=./aptos_wallets.txt 
PONTEM_PW=xxxxx自己的密码
INVITE_LINK=https://url3.me/sqob8o 邀请链接改成自己的
WALLET_COUNT=3 创建钱包数量，先创建 少一点 测试一下

// 创建钱包 
node create_aptos_wallets.js
// 批量转账
node aptos_batch_transfer.js 有apt账户的私钥（不要带0x开头） 1.3 （如果要质押1个apt，至少要1.3个apt）
// 质押
node stake_on_amnis.js

// 链上直接质押
node stake_on_amnis_chain.js
``` 
