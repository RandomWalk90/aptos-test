const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

async function createSafePalWallet(privateKey) {
  try {
    // 验证私钥
    if (!privateKey) {
      throw new Error('请提供私钥作为命令行参数');
    }

    // 验证私钥格式（假设是64位十六进制字符串）
    if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error('私钥格式不正确，应为64位十六进制字符串');
    }

    // 获取存储私钥的文件路径
    const AmnisLINK = process.env.INVITE_LINK;
    const PONTEM_PW = process.env.PONTEM_PW;
    const keyFilePath = process.env.KEY_FILE_PATH;
    if (!keyFilePath) {
      throw new Error('未设置 KEY_FILE_PATH 环境变量');
    }

    // 获取插件的绝对路径
    const extensionPath = path.join(__dirname, 'ext');

    // 启动浏览器，添加剪贴板权限
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--enable-clipboard-read',
        '--enable-clipboard-write',
        '--enable-clipboard-sanitizer'
      ],
      // 添加额外的权限
      ignoreDefaultArgs: ['--disable-extensions'],
      defaultViewport: {
        width: 1280,
        height: 800
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    // 获取所有已打开的页面
    const pages = await browser.pages();
    // 使用第一个页面，而不是创建新页面
    const extensionPage = pages[0];
    // await extensionPage.bringToFront();
    pages[1].close();
    // 等待一小段时间确保页面切换完成
    await new Promise(resolve => setTimeout(resolve, 500));
    await extensionPage.goto('chrome-extension://pbknbblgbelkealcigmnbfklledmkanm/src/extension-ui/index.html#/auth/reset?flow=restore');

    // 等待导入选项加载
    await extensionPage.waitForSelector('._content_3i7ju_12');

    // 替代方案：使用文本内容定位
    await extensionPage.waitForFunction(() => {
      const items = document.querySelectorAll('._item_3i7ju_30');
      return Array.from(items).some(item =>
        item.textContent.includes('Import by Private Key')
      );
    });

    await extensionPage.evaluate(() => {
      const items = Array.from(document.querySelectorAll('._item_3i7ju_30'));
      const privateKeyItem = items.find(item =>
        item.textContent.includes('Import by Private Key')
      );
      if (privateKeyItem) privateKeyItem.click();
    });
    await extensionPage.waitForSelector('div._item_1jrh3_12:has(img[alt="aptos"])');
    await extensionPage.click('div._item_1jrh3_12:has(img[alt="aptos"])');

    // 等待私钥输入框出现
    await extensionPage.waitForSelector('textarea[placeholder="Account private key"]');
    // Please enter account name
    await extensionPage.type('input[placeholder="Please enter account name"]', 'aptos');
    // 直接输入私钥
    await extensionPage.type('textarea[placeholder="Account private key"]', privateKey);

    // 等待输入生效
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('私钥已输入');
    await extensionPage.$$eval('button', (buttons) => {
      const createButton = buttons.find(button => button.textContent.includes('Import'));
      if (createButton) createButton.click();
    });
    //   // 设置钱包密码
    await extensionPage.waitForSelector('input[type="password"]');
    await extensionPage.type('input[type="password"][id="password"]', PONTEM_PW);
    await extensionPage.type('input[type="password"][name="confirm"]', PONTEM_PW);
    //      // 等待并同意条款
    await extensionPage.waitForSelector('input[type="checkbox"]');
    await extensionPage.$$eval('label', (buttons) => {
      const createButton = buttons.find(button => button.textContent.includes('I accept the'));
      if (createButton) createButton.click();
    });
    // 等待输入生效
    await new Promise(resolve => setTimeout(resolve, 500));
    // // 方案1：使用 XPath 选择包含文本的按钮
    await extensionPage.$$eval('button', (buttons) => {
      const createButton = buttons.find(button => button.textContent.includes('Create'));
      if (createButton) createButton.click();
    });


    await new Promise(resolve => setTimeout(resolve, 500));

    const stakePage = await browser.newPage();
    await stakePage.goto(AmnisLINK);
    await stakePage.$$eval('button', (buttons) => {
      const createButton = buttons.find(button => button.textContent.includes('Connect Wallet'));
      if (createButton) createButton.click();

    });

    await stakePage.$$eval('button', (buttons) => {
      const createButton = buttons.find(button => button.textContent.includes('Pontem'));
      if (createButton) createButton.click();
    });

    // 等待插件弹窗出现
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 获取所有页面，找到插件弹窗页面
    const pagesNew = await browser.pages();
    const popupPage = pagesNew[pagesNew.length - 1];  // 通常是最后打开的页面

    // 等待 Continue 按钮出现并点击
    await popupPage.waitForSelector('button');
    await popupPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const continueButton = buttons.find(button => button.textContent.includes('Continue'));
      if (continueButton) continueButton.click();
    });

    // 等待操作完成
    await new Promise(resolve => setTimeout(resolve, 500));

    await popupPage.$$eval('button', (buttons) => {
      const createButton = buttons.find(button => button.textContent.includes('Connect'));
      if (createButton) createButton.click();
    });

    // 等待页面加载完成
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 等待第一个输入框出现
    await stakePage.waitForSelector('.swap-input:first-child input.positiveFloatNumInput');

    // 生成随机数 1 + random(0, 0.1)
    const amount = (1 + Math.random() * 0.1).toFixed(2);
    // 清除输入框现有内容并输入新值
    // await stakePage.evaluate((amount) => {
    //     // 选择第一个 swap-input 中的输入框
    //     const inputs = Array.from(document.querySelectorAll('.swap-input input.positiveFloatNumInput'));
    //     const firstInput = inputs.find(input => !input.disabled);

    // }, amount);
    stakePage.type('.swap-input:first-child input.positiveFloatNumInput', `${amount}`);

    console.log(`输入金额: ${amount}`);

    // 等待输入生效
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 点击 Mint & Stake 按钮
    await stakePage.$$eval('button', (buttons) => {
      const createButton = buttons.find(button => button.textContent.includes('Mint Only'));
      if (createButton) createButton.click();
    });

    // 等待插件弹窗出现
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 获取所有页面，找到插件弹窗页面
    const pages2 = await browser.pages();
    const popupPage2 = pages2[pages2.length - 1];  // 通常是最后打开的页面

    //  // 等待 Confirm 按钮出现并且可点击
    //  await popupPage2.waitForFunction(() => {
    //      const buttons = Array.from(document.querySelectorAll('button'));
    //      const confirmButton = buttons.find(button => button.textContent.includes('Confirm'));
    //      // 检查按钮是否存在且不是禁用状态
    //      return confirmButton && !confirmButton.disabled;
    //  }, { timeout: 30000 }); // 设置30秒超时
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 点击 Confirm 按钮
    await popupPage2.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirmButton = buttons.find(button => button.textContent.includes('Confirm'));
      if(confirmButton && !confirmButton.disabled){
      console.log(confirmButton);
      confirmButton.click();
      }else{
        await new Promise(resolve => setTimeout(resolve, 3000));
        const confirmButton = buttons.find(button => button.textContent.includes('Confirm'));
        console.log(confirmButton);
        confirmButton.click();
        // console.log('confirmButton is disabled');
      }
    });

    // 等待操作完成
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close()
    //    await extensionPage.waitForSelector('div._item_1jrh3_12:has(img[alt="aptos"])');
    //   await extensionPage.click('div._item_1jrh3_12:has(img[alt="aptos"])');





    //       // 或者方案3：使用 $$eval
    //     await extensionPage.$$eval('button', (buttons) => {
    //         const createButton = buttons.find(button => button.textContent.includes('Copy'));
    //         if (createButton) createButton.click();
    //     });


    //   // 等待助记词容器出现
    //   await extensionPage.waitForSelector('._phraseContainer_eaaht_62');

    //   // 获取助记词
    //   const mnemonicWords = await extensionPage.evaluate(() => {
    //       const container = document.querySelector('.MuiGrid-container');
    //       const wordElements = container.querySelectorAll('.MuiGrid-grid-xs-4 div p:nth-child(2)');
    //       return Array.from(wordElements)
    //           .map(el => el.textContent)
    //           .join(' ');
    //   });

    //   console.log('请安全保管您的助记词：', mnemonicWords);

    //   // 将助记词追加到文件
    //   await fs.appendFile(keyFilePath, `\n${mnemonicWords}`);
    //   console.log('助记词已保存到文件');

    //   // 点击复制按钮
    //   await extensionPage.waitForSelector('._copyButton_jripg_12');
    //   await extensionPage.click('._copyButton_jripg_12');

    //   // 等待一小段时间确保复制操作完成
    //   await new Promise(resolve => setTimeout(resolve, 500));

    //      // 等待并同意条款
    //      await extensionPage.waitForSelector('input[type="checkbox"]');
    //      await extensionPage.$$eval('label', (buttons) => {
    //       const createButton = buttons.find(button => button.textContent.includes('I saved my recovery passphrase'));
    //       if (createButton) createButton.click();
    //   });


    //   await extensionPage.$$eval('button', (buttons) => {
    //     const createButton = buttons.find(button => button.textContent.includes('Continue'));
    //     if (createButton) createButton.click();
    //   });




    //   // 验证助记词
    //   await extensionPage.waitForSelector('._phraseContainer_1uokb_12');

    //   // 获取需要填写的助记词位置和正确的单词
    //   const emptyPositionsAndWords = await extensionPage.evaluate((savedMnemonic) => {
    //       // 将保存的助记词转换为数组
    //       const savedWords = savedMnemonic.split(' ');

    //       // 获取所有助记词位置
    //       const wordElements = document.querySelectorAll('._mnemonicWord_eaaht_73');
    //       const emptySlots = [];

    //       // 找出空缺的位置
    //       Array.from(wordElements).forEach((el, index) => {
    //           const wordText = el.querySelector('p:nth-child(2)').textContent;
    //           if (!wordText) {
    //               // 位置从1开始，所以index要加1
    //               emptySlots.push({
    //                   position: index + 1,
    //                   word: savedWords[index]
    //               });
    //           }
    //       });

    //       return emptySlots;
    //   }, mnemonicWords); // 传入之前保存的助记词字符串

    //   // 依次点击正确的单词
    //   for (const slot of emptyPositionsAndWords) {
    //       // 等待当前空位被标记为当前选择
    //       await extensionPage.waitForSelector(`._mnemonicWord_eaaht_73._emptyWord_1uokb_69._currentWord_1uokb_73`);

    //       // 在底部选项中找到并点击正确的单词
    //       await extensionPage.evaluate((word) => {
    //           const buttons = Array.from(document.querySelectorAll('._mnemonicWord_1uokb_48'));
    //           const correctButton = buttons.find(button => button.textContent === word);
    //           if (correctButton) {
    //               correctButton.click();
    //           }
    //       }, slot.word);

    //       // 等待一小段时间确保点击生效
    //       await new Promise(resolve => setTimeout(resolve, 300));
    //   }

    //   // 等待验证完成
    //   await new Promise(resolve => setTimeout(resolve, 1000));
    //   await extensionPage.$$eval('button', (buttons) => {
    //     const createButton = buttons.find(button => button.textContent.includes('Confirm'));
    //     if (createButton) createButton.click();
    //   });
    //   console.log('Pontem 钱包创建成功！');

    //   // 可选：等待一段时间以确保所有操作完成
    //   await new Promise(resolve => setTimeout(resolve, 2000));

    //   // 等待钱包初始化完成
    //   await extensionPage.waitForSelector('.wallet-home');

  } catch (error) {
    console.error('创建钱包时发生错误：', error);
  }
}

async function batchStake() { 
  // 从命令行参数获取私钥
// const privateKey = process.argv[2];
const keyFilePath = process.env.KEY_FILE_PATH;
// 从文件读取接收地址
const fileContent = await fs.readFile(keyFilePath, 'utf8');
const recipientPK = fileContent
  .split('\n')
  .map(line => line.trim())
  .filter(line => line)
  .map(line => line.split(',')[0])
  // .filter(address => address && address.length === 66);
// 运行函数
// recipientPK.forEach(pk => {
  // createSafePalWallet(pk); 
// })
  for (let i = 0; i < recipientPK.length; i++) {
    await createSafePalWallet(recipientPK[i]);
    await new Promise(resolve => setTimeout(resolve, 1000));

  }
//  Promise.all(recipientPK.map(pk =>awaitcreateSafePalWallet(pk)));
}

batchStake();
// createSafePalWallet(privateKey); 