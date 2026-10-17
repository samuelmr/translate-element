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

## Which translations belong to which element

Hand-authored translations are the other-language elements in the same run of adjacent siblings with the same tag name and a `lang` attribute. When a run holds several elements in the page's own language, each translation belongs to one of them. If the run starts with an element in the page's language, translations follow their source; if it starts with a translation, they precede it:

```html
<!-- translations follow: "Welcome" owns sv, "Hello" owns de -->
<p lang="en">Welcome</p><p lang="sv">Välkommen</p>
<p lang="en">Hello</p><p lang="de">Hallo</p>

<!-- translations precede: each fi option belongs to the en option after it -->
<option lang="fi" value="1">yksin</option><option lang="en" value="1">alone</option>
<option lang="fi" value="2">kumppanin</option><option lang="en" value="2">partner</option>
```

## Untranslated content

An element in the page's language with no translation at all (no dictionary entry and no hand-authored translation of its own) gets a console warning. By default it also loses its `lang` attribute, so it is shown in every language: a missing dictionary entry then shows up as untranslated text instead of hiding, say, a button or an input. This doesn't happen when the element sits in a run with other-language siblings, because they show the author is translating that part by hand:

```html
<!-- in English, only "C" is shown -->
<p lang="fi">A</p>
<p lang="fi">B</p>
<p lang="en">C</p>
```

Add the `strict` attribute to treat `lang` exactly as written everywhere: an untranslated element keeps its `lang` and is hidden in the other languages.

```html
<translate-element strict src="translations.json"></translate-element>
```

## Upgrading from 3.x

4.0 doesn't change the API, but some pages may render differently:

- A hand-authored sibling now wins over a dictionary entry for its own language. Previously both were shown.
- A hand-authored translation now belongs to one source element (see above). Previously any lang-tagged neighbour counted, so two adjacent untranslated elements in the page's language kept each other's `lang` and were hidden in every other language; now they are shown.
- New: the `strict` attribute.

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
