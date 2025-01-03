const puppeteer = require('puppeteer');

async function manageExtensionPermissions() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--enable-automation',
      `--load-extension=${extensionPath}`
    ]
  });

  // 访问插件管理页面
  const page = await browser.newPage();
  await page.goto('chrome://extensions');
  
  // 等待插件加载
  await page.waitForTimeout(1000);
  
  // 其他权限管理操作...
} 