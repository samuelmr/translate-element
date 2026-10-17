# translate-element

A simple web component for translating text content in HTML pages.

Author your HTML content in any language. Mark the translatable sections with the lang attribute. Create a JSON file for translations. Add the web component to your page, and it will render a language switcher element for the languages found.

1. Include the JavaScript file in your HTML:

```html
<script src="translate-element.js"></script>
```

2. Optionally, style the language switcher element using CSS:

```html
<link rel="stylesheet" href="translate-element.css">
```

3. Add the translate element to your page and EITHER, embed the translations into your page:

```html
<translate-element></translate-element>
<h1 lang="en">Welcome</h1>
<h1 lang="sv">Välkommen</h1>
<h1 lang="de">Willkommen</h1>
```

4. OR, create a translation file (in JSON format), publish it in your web site, and refer to it via the `src` attribute:

`translations.json`

```json
{
  "Text to translate": {
    "sv": "Text att översätta",
    "de": "Text zu übersetz"
  },
  "Welcome": {
    "sv": "Välkommen",
    "de": "Willkommen"
  }
}
```

`index.html`

```html
<translate-element src="translations.json"></translate-element>
<h1 lang="en">Welcome</h1>
```

5. You can also combine the two: a hand-authored sibling wins over the translation file for its own language, and the file fills in the rest. Here the Swedish heading is the hand-authored one, and German comes from `translations.json`:

```html
<translate-element src="translations.json"></translate-element>
<h1 lang="en">Welcome</h1>
<h1 lang="sv">Välkommen hit</h1>
```

## Remembering the language across pages

By default the chosen language lives only in the `?lang=` query parameter, so it is lost when the visitor follows a link to another page. Add the `persist` attribute to remember the choice made with the switcher in `localStorage` (key `translate-element:lang`):

```html
<translate-element persist prefer-browser-language src="translations.json"></translate-element>
```

The language shown on load is the first of these that the page has content for:

1. the `?lang=` query parameter (it is never stored, so a shared link doesn't change the visitor's own preference),
2. the stored choice (`persist`),
3. the browser's preferred languages, `navigator.languages` (`prefer-browser-language`; `fi-FI` matches `fi`),
4. the page's own language.

If `localStorage` is unavailable, the choice is simply not remembered.

## Events

`<translate-element>` dispatches a bubbling `languagechange` event whenever the displayed language changes, including the initial choice on load, with `detail: { language, previousLanguage }`. The `lang` attribute of `<html>` is also kept up to date, so a `MutationObserver` on it keeps working.

```js
document.addEventListener('languagechange', (e) => console.log(e.detail.language))
```

See [documentation](https://samuelmr.github.io/translate-element/) for further instructions.
