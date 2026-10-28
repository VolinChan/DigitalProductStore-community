import { expect, type Page } from '@playwright/test';
import axe from 'axe-core';

export async function expectAccessiblePage(page: Page) {
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  const transition = page.locator('.sf-page-transition');
  if (await transition.count()) await expect(transition).toHaveCSS('opacity', '1');
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const engine = (window as unknown as { axe: typeof axe }).axe;
    const result = await engine.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    });
    return result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
  });
  expect(violations).toEqual([]);
}
