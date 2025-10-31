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

See [documentation](https://samuelmr.github.io/translate-element/) for further instructions.
