const { test, expect } = require('@playwright/test')

/**
 * translateElement()'s "translate child elements first" step shares a single
 * `this.translationQueue` array with the top-level loadHandler() loop, instead of using
 * a queue scoped to that one call. Since document.querySelectorAll('[lang]') queues every
 * translatable element up front, an element that's still sitting in that shared queue can
 * get popped and processed from *inside* an unrelated element's own child-processing loop
 * - including an ancestor being pulled in from inside its own not-yet-finished descendant's
 * call, or two unrelated siblings interleaving into each other's call stack.
 *
 * Manual tracing suggests this can't corrupt a textContent-based key in practice: the
 * `processedElements` guard means an element is always fully translated (siblings
 * inserted) either before its "child processing" step starts pulling from the queue, or
 * strictly after any ancestor that gets pulled in mid-way finishes computing its own key -
 * never in between. This test exercises a case designed to break that if it's wrong: two
 * independent nested groups (a container plus its own separately-translated child),
 * interleaved with plain top-level siblings, so the queue is shared across multiple
 * unrelated subtrees at once. Confirmed to pass against the current implementation - if a
 * future change to the queueing makes this fail, that's a real corruption, not a fluke.
 */
test.describe('nested translatable elements + shared translationQueue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/fixtures/static-nested.html')
    await page.locator('translate-element ul').waitFor()
  })

  test('translates every top-level sibling and both nested groups without warnings', async ({ page }) => {
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })
    await page.reload()
    await page.locator('translate-element ul').waitFor()
    expect(warnings).toEqual([])
  })

  test('a nested child gets its own, independent translation', async ({ page }) => {
    await expect(page.locator('#inner-1')).toHaveAttribute('lang', 'en')
    await expect(page.locator('span[lang="sv"]', { hasText: 'Inre ett' })).toHaveCount(1)
    await expect(page.locator('#inner-2')).toHaveAttribute('lang', 'en')
    await expect(page.locator('span[lang="sv"]', { hasText: 'Inre två' })).toHaveCount(1)
  })

  test("a container's own key reflects its original, uncorrupted text - not text with a child's translation spliced in", async ({ page }) => {
    // if the shared queue let a child's translated sibling get inserted before the
    // container computed its own key, the container's key would pick up the extra
    // text and the dict lookup below would fail (see the class doc comment above)
    const outer1Sv = page.locator('div[lang="sv"]', { hasText: 'Inre och yttre text ett' })
    await expect(outer1Sv).toHaveCount(1)
    await expect(outer1Sv).toHaveText('Inre och yttre text ett')
    const outer2Sv = page.locator('div[lang="sv"]', { hasText: 'Inre och yttre text två' })
    await expect(outer2Sv).toHaveCount(1)
    await expect(outer2Sv).toHaveText('Inre och yttre text två')
  })

  test('plain top-level siblings interleaved with the nested groups all translate correctly', async ({ page }) => {
    await expect(page.locator('#before')).toHaveAttribute('lang', 'en')
    await expect(page.locator('h2[lang="sv"]', { hasText: 'Före' })).toHaveCount(1)
    await expect(page.locator('h2[lang="sv"]', { hasText: 'Mitten' })).toHaveCount(1)
    await expect(page.locator('h2[lang="sv"]', { hasText: 'Efter' })).toHaveCount(1)
  })

  test('switching language shows the container\'s own translation - the nested child\'s independent translation stays unreachable', async ({ page }) => {
    // this isn't the queue-sharing bug this file is about - it's a separate, real quirk:
    // #outer-1 has its own dict entry, so its sv clone (#outer-1-sv) is a standalone
    // replacement block with no nested structure at all. #inner-1's own sv clone
    // (#inner-1-sv, asserted separately above) is still there, but nested inside the
    // *original* #outer-1, which stays lang="en" and hidden for any non-default language -
    // so a nested translation only stays reachable if no ancestor also has its own entry
    await page.locator('translate-element ul li a[hreflang="sv"]').click()
    await expect(page.locator('#outer-1')).toBeHidden()
    await expect(page.locator('#outer-1-sv')).toBeVisible()
    await expect(page.locator('#outer-1-sv')).toHaveText('Inre och yttre text ett')
    await expect(page.locator('#inner-1-sv')).toBeHidden()
  })
})
