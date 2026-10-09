import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toPlainText } from '../../src/lib/plain-text.ts';
import { formatOrderItemAttributes } from '../../src/lib/order-line.ts';

for (const [input, expected] of [
  ['<p>Amplía tu red con este <strong>switch</strong>.</p><p>8 puertos<br>RJ45</p>', 'Amplía tu red con este switch. 8 puertos RJ45'],
  ['<p>USB&nbsp;&amp; HDMI &#8212; &#x1F50C; &quot;Pro&quot;</p>', 'USB & HDMI — 🔌 "Pro"'],
  ['<p title="2 > 1">USB<em>-C</em></p>', 'USB-C'],
  ['<!-- internal note --><style>.hidden {}</style><script>alert(1)</script><p>Cable</p>', 'Cable'],
  ['Length < 5 m & power > 10 W', 'Length < 5 m & power > 10 W'],
  ['<p>&lt;script&gt;example&lt;/script&gt;</p>', '<script>example</script>'],
  ['<p> </p><p><br></p>', ''],
  ['<p>&#0; &#xD800; &#x110000;</p>', '� � �'],
  [undefined, ''],
]) {
  test(`product summary becomes plain display text: ${input}`, () => {
    assert.equal(toPlainText(input), expected);
  });
}

for (const [attributes, expected] of [
  ['{}', ''], ['{ }', ''], ['[]', ''], ['null', ''], ['', ''],
  ['{"Color":"Black","Length":"1m"}', 'Color: Black · Length: 1m'],
  ['[{"name":"Color","value":"Yellow"},{"name":"Length","value":"2m"}]', 'Color: Yellow · Length: 2m'],
  ['{"Color":" ","Length":null,"Other":{}}', ''],
  ['[{"name":"Color","value":""}]', ''],
  ['{"Ports":0,"Wireless":false}', 'Ports: 0 · Wireless: false'],
  ['Color: Black', 'Color: Black'],
  ['"Black"', 'Black'],
]) {
  test(`order attributes render without JSON syntax: ${attributes}`, () => {
    assert.equal(formatOrderItemAttributes({ attributes }), expected);
  });
}

test('order variants prefer their purchase snapshot over legacy attributes', () => {
  assert.equal(formatOrderItemAttributes({ variant_summary_snapshot: 'Color: Blue', attributes: '{"Color":"Red"}' }), 'Color: Blue');
  assert.equal(formatOrderItemAttributes({ variant_summary_snapshot: '{}', attributes: '{"Color":"Red"}' }), '');
  assert.equal(formatOrderItemAttributes({ variant_summary_snapshot: ' ', attributes: '{"Color":"Red"}' }), 'Color: Red');
});
