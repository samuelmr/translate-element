const { test, expect } = require('@playwright/test')

test.describe('static HTML + translations.json', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/fixtures/static-dict.html')
    await page.locator('translate-element ul').waitFor()
  })

  test('translates plain text content and keeps the original tagged', async ({ page }) => {
    const heading = page.locator('#heading')
    await expect(heading).toHaveAttribute('lang', 'en')
    await expect(heading).toHaveText('Welcome')

    await expect(page.locator('h1[lang="sv"]')).toHaveCount(1)
    await expect(page.locator('h1[lang="sv"]')).toHaveText('Välkommen')
    await expect(page.locator('h1[lang="de"]')).toHaveCount(1)
    await expect(page.locator('h1[lang="de"]')).toHaveText('Willkommen')
    await expect(page.locator('h1[lang="fr"]')).toHaveCount(1)
    await expect(page.locator('h1[lang="fr"]')).toHaveText('Bienvenue')
  })

  test('does not invent a translation for a language missing from the dict entry', async ({ page }) => {
    // "Hello there" only has sv/de in translations.json, no fr
    await expect(page.locator('#paragraph')).toHaveAttribute('lang', 'en')
    await expect(page.locator('p[lang="sv"]')).toHaveText('Hej där')
    await expect(page.locator('p[lang="de"]')).toHaveText('Hallo da')
    await expect(page.locator('p[lang="fr"]')).toHaveCount(0)
  })

  test('translates a button-type input via its value, not textContent', async ({ page }) => {
    await expect(page.locator('#submit-button')).toHaveAttribute('lang', 'en')
    const svButton = page.locator('input[type="submit"][lang="sv"]')
    await expect(svButton).toHaveCount(1)
    await expect(svButton).toHaveValue('Skicka')
    const deButton = page.locator('input[type="submit"][lang="de"]')
    await expect(deButton).toHaveValue('Senden')
  })

  test('translates attribute-only content (placeholder/title) when textContent has no match', async ({ page }) => {
    await expect(page.locator('#text-input')).toHaveAttribute('lang', 'en')
    const svInput = page.locator('input[type="text"][lang="sv"]')
    await expect(svInput).toHaveCount(1)
    await expect(svInput).toHaveAttribute('placeholder', 'Ange ditt namn')
    await expect(svInput).toHaveAttribute('title', 'Ange ditt namn')
  })

  test('translates the optgroup label', async ({ page }) => {
    await expect(page.locator('#fruit-group')).toHaveAttribute('lang', 'en')
    const svGroup = page.locator('optgroup[lang="sv"]')
    await expect(svGroup).toHaveCount(1)
    await expect(svGroup).toHaveAttribute('label', 'Frukt')
    const deGroup = page.locator('optgroup[lang="de"]')
    await expect(deGroup).toHaveAttribute('label', 'Obst')
  })

  test('translates every nested <option> inside each optgroup clone', async ({ page }) => {
    // the optgroup guard (translate-element.js) skips an option's own translateElement()
    // call to avoid it creating stray siblings inside the still-untranslated optgroup;
    // translateNestedOptions() then fills in that translation once the optgroup itself
    // has been cloned for a language - this fixture has two options to confirm both get it
    await expect(page.locator('optgroup[lang="en"] option[value="apple"]')).toHaveAttribute('label', 'First option')
    await expect(page.locator('optgroup[lang="en"] option[value="banana"]')).toHaveAttribute('label', 'Second option')

    const svApple = page.locator('optgroup[lang="sv"] option[value="apple"]')
    await expect(svApple).toHaveAttribute('lang', 'sv')
    await expect(svApple).toHaveText('Första alternativet')
    await expect(svApple).toHaveAttribute('label', 'Första alternativet')
    const svBanana = page.locator('optgroup[lang="sv"] option[value="banana"]')
    await expect(svBanana).toHaveAttribute('lang', 'sv')
    await expect(svBanana).toHaveText('Andra alternativet')

    const deApple = page.locator('optgroup[lang="de"] option[value="apple"]')
    await expect(deApple).toHaveAttribute('lang', 'de')
    await expect(deApple).toHaveText('Erste Option')
    const deBanana = page.locator('optgroup[lang="de"] option[value="banana"]')
    await expect(deBanana).toHaveAttribute('lang', 'de')
    await expect(deBanana).toHaveText('Zweite Option')
  })

  test('caches title translations without duplicating the <title> element', async ({ page }) => {
    await expect(page.locator('title')).toHaveCount(1)
    await expect(page.title()).resolves.toBe('Page title')
  })

  test('builds a language switcher covering every language discovered', async ({ page }) => {
    const items = page.locator('translate-element ul li a')
    await expect(items).toHaveCount(4)
    await expect(page.locator('translate-element ul li a[hreflang="en"]')).toHaveCount(1)
    await expect(page.locator('translate-element ul li a[hreflang="sv"]')).toHaveCount(1)
    await expect(page.locator('translate-element ul li a[hreflang="de"]')).toHaveCount(1)
    await expect(page.locator('translate-element ul li a[hreflang="fr"]')).toHaveCount(1)
    await expect(page.locator('translate-element ul li.selected a[hreflang="en"]')).toHaveCount(1)
  })

  test('switching language via the switcher toggles visibility and updates the title', async ({ page }) => {
    await expect(page.locator('#heading')).toBeVisible()
    await expect(page.locator('h1[lang="sv"]')).toBeHidden()

    await page.locator('translate-element ul li a[hreflang="sv"]').click()

    await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
    await expect(page.locator('#heading')).toBeHidden()
    await expect(page.locator('h1[lang="sv"]')).toBeVisible()
    await expect(page.locator('translate-element ul li.selected a[hreflang="sv"]')).toHaveCount(1)
    await expect(page.title()).resolves.toBe('Sidtitel')
  })
})
