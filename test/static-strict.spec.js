const { test, expect } = require('@playwright/test')

test.describe('the strict attribute', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/fixtures/static-strict.html')
    await page.locator('translate-element ul').waitFor()
  })

  test('keeps the lang attribute on an untranslated element and hides it in other languages', async ({ page }) => {
    await expect(page.locator('#orphan')).toHaveAttribute('lang', 'en')
    await expect(page.locator('#orphan')).toBeVisible()
    await page.locator('translate-element ul li a[hreflang="sv"]').click()
    await expect(page.locator('#orphan')).toBeHidden()
  })

  test('still warns about the missing translation', async ({ page }) => {
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })
    await page.reload()
    await page.locator('translate-element ul').waitFor()
    expect(warnings.some((w) => w.includes('Nobody translated me'))).toBe(true)
  })

  test('translates from the dict as usual', async ({ page }) => {
    await page.locator('translate-element ul li a[hreflang="sv"]').click()
    await expect(page.locator('h1:visible')).toHaveText(['Välkommen'])
  })
})
