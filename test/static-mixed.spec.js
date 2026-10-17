const { test, expect } = require('@playwright/test')

test.describe('static HTML + translations.json + hand-authored siblings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/fixtures/static-mixed.html')
    await page.locator('translate-element ul').waitFor()
  })

  test('a hand-authored sibling wins over the dict entry for its language', async ({ page }) => {
    // "Welcome" is a dict key with sv/de/fr - the hand-authored sv must not get a second sv copy
    await expect(page.locator('h1[lang="sv"]')).toHaveCount(1)
    await expect(page.locator('h1[lang="sv"]')).toHaveText('Välkommen hit')
    await page.locator('translate-element ul li a[hreflang="sv"]').click()
    await expect(page.locator('h1:visible')).toHaveCount(1)
    await expect(page.locator('#heading-sv')).toBeVisible()
  })

  test('the dict still adds the languages the hand-authored siblings lack', async ({ page }) => {
    await expect(page.locator('h1[lang="de"]')).toHaveText('Willkommen')
    await expect(page.locator('h1[lang="fr"]')).toHaveText('Bienvenue')
    await expect(page.locator('#heading')).toHaveAttribute('lang', 'en')
  })

  test('a hand-authored sibling that precedes its source also wins', async ({ page }) => {
    await expect(page.locator('h2[lang="de"]')).toHaveCount(1)
    await expect(page.locator('h2[lang="de"]')).toHaveText('Abbruch')
    await expect(page.locator('h2[lang="sv"]')).toHaveText('Avbryt')
  })

  test('a hand-authored sibling wins over a dict entry for an attribute', async ({ page }) => {
    await expect(page.locator('input[lang="sv"]')).toHaveCount(1)
    await expect(page.locator('input[lang="sv"]')).toHaveAttribute('placeholder', 'Ditt namn')
    await expect(page.locator('input[lang="de"]')).toHaveAttribute('placeholder', 'Geben Sie Ihren Namen ein')
  })

  test('another source element and its clones are not mistaken for hand-authored siblings', async ({ page }) => {
    // #hello and #submit are adjacent dict-translated <p>s: each gets its own sv/de copies
    await expect(page.locator('body > p[lang="sv"]')).toHaveText(['Hej där', 'Skicka'])
    await expect(page.locator('body > p[lang="de"]')).toHaveText(['Hallo da', 'Senden'])
  })

  test('adjacent untranslated default-language elements are not each other\'s translations', async ({ page }) => {
    expect(await page.locator('#untranslated-a').getAttribute('lang')).toBeNull()
    expect(await page.locator('#untranslated-b').getAttribute('lang')).toBeNull()
    await page.locator('translate-element ul li a[hreflang="sv"]').click()
    await expect(page.locator('#untranslated-a')).toBeVisible()
    await expect(page.locator('#untranslated-b')).toBeVisible()
  })

  test('translations that follow their sources belong to the nearest source before them', async ({ page }) => {
    // the run starts with a source, so the sv paragraph is #follow-a's, not #follow-b's -
    // #follow-b ("Hello there") still gets its sv copy from the dict, but not a second de
    await expect(page.locator('#follow p[lang="sv"]')).toHaveText(['Eget A', 'Hej där'])
    await expect(page.locator('#follow p[lang="de"]')).toHaveText(['Eigen B'])
  })

  test('translations that precede their sources belong to the nearest source after them', async ({ page }) => {
    await expect(page.locator('#precede p[lang="sv"]')).toHaveText(['Hand hej', 'Hand välkommen'])
    await expect(page.locator('#precede p[lang="de"]')).toHaveText(['Hallo da', 'Willkommen'])
    await expect(page.locator('#precede p[lang="fr"]')).toHaveText(['Bienvenue'])
  })

  test('an untranslated element next to another source\'s translation stays hidden in that language', async ({ page }) => {
    // like any lang-aware renderer: the sv view shows only the sv paragraph
    await expect(page.locator('#group-a')).toHaveAttribute('lang', 'en')
    await expect(page.locator('#group-b')).toHaveAttribute('lang', 'en')
    await page.locator('translate-element ul li a[hreflang="sv"]').click()
    await expect(page.locator('#group p:visible')).toHaveText(['Grupp C'])
  })
})
