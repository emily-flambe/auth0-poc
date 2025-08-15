const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    console.log('1. Navigating to localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'step1-homepage.png' });
    
    console.log('2. Looking for login button...');
    await page.waitForSelector('button', { timeout: 5000 });
    
    // Get all buttons and find the login one
    const loginButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Login'));
    });
    
    if (loginButton) {
      console.log('3. Clicking login button...');
      await loginButton.click();
      
      // Wait a bit to see what happens
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('4. Current URL:', page.url());
      await page.screenshot({ path: 'step2-after-login-click.png' });
      
      // Check if we're on Auth0 domain
      if (page.url().includes('auth0.com')) {
        console.log('5. Reached Auth0 login page');
        await page.screenshot({ path: 'step3-auth0-page.png' });
        
        // Try to find error messages
        const errorText = await page.evaluate(() => {
          const errorEl = document.querySelector('.error-message, .alert, [role="alert"]');
          return errorEl ? errorEl.textContent : null;
        });
        
        if (errorText) {
          console.log('AUTH0 ERROR:', errorText);
        }
      } else {
        console.log('5. Still on localhost, checking for errors...');
        const errorContent = await page.evaluate(() => {
          const errorEl = document.querySelector('.error');
          return errorEl ? errorEl.textContent : null;
        });
        console.log('Error on page:', errorContent);
      }
    } else {
      console.log('Login button not found!');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
  }
  
  console.log('\nKeeping browser open for inspection. Press Ctrl+C to close.');
  // Keep browser open for manual inspection
  await new Promise(() => {});
})();