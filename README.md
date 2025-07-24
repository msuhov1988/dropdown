## Dropdown Plug-in
#### A vanilla JavaScript web component: dropdown list

### Features
##### No dependencies
##### Can be attached to any HTML element
##### Supports keyboard management
##### Virtual scrolling of options
##### Single and multiple selection modes
##### Flexible styling using CSS variables

### Files
##### `src/attach_module.js` — uses ES6 modules
##### `src/attach_no_module.js` — does not use ES6 modules
##### `demo/index.html` — demo example

### 1. Core Methods of the Component Object
###### Data Management
`(get/set) data` - returns or sets the array of options.

Options array: An array of objects with mandatory properties `label` and `value`.

Note: Do not use arrays as the value of the `value` property.

######  Validation
`(get/set) validation` - returns or sets a boolean flag enabling or disabling options array validation.

###### Custom Template
`(get/set) templateCreator` - returns or sets a function used to create custom option templates.

Function must:

- Return a `DocumentFragment`.

Important: Since the output is inserted into the Shadow DOM, external CSS styles will not affect these templates.

###### Display management
`open(masterElem, value)` - opens (displays) the component attached to html element `masterElem`.

value parameter:

- An array of selected values (for multiple selection mode).

- Any single value for single selection mode.

Note: If no values are selected, defaults must be used by external code: an empty array for multimode, or an arbitrary non-existing value for single mode.

External code responsibility: Ensuring correctness of values passed.
___
`close()` - closes (hides) the component.

Note: Previously passed values are not stored.
___
`externalFiltration(text)` - used to attach filtering capability to an external input element.

text — any string, but probably current value of the external input.
___
Note: Since it is a plug-in component, its opening and closing must be controlled by external code. The component itself closes when you click on the element it is connected to again

### 2. Events Emitted

###### Selection Event
```  
  new CustomEvent("attachSelect", {
      bubbles: true,
      detail: {
          element,      // the html element to which the component is attached
          multiple,     // true if multiple mode, false otherwise
          value,        // selected value
          option        // object { label, value } corresponds to selected value
  }
})  
```
###### Reset Event 
```
new CustomEvent("attachReset", {
  bubbles: true,
  detail: {
    element,      // the html element to which the component is attached
    multiple,     // true if multiple mode, false otherwise
    value         // array of values (multi) or single value (single)
  }
})
```                 
                
Note: The component does not store selected values internally; it relies on external code provided during `open()`.

### 3. HTML Attributes & Corresponding Object Methods
Attributes can be set in HTML or via the corresponding methods, but further management should be done through those methods.

| Attribute | Description | Method | Details |

|------------|--------------|---------|---------|

| `data-fast-filter` | Enable fast filtering (boolean flag) | `(get/set) fastFilter` | If true, precomputes label array for efficiency; if false, processes on the fly. |

| `data-height` | Options container height | `(get) heights` / `(set) heights = [height, optionHeight]` | Heights in pixels as integers. |

| `data-option-height` | Height of individual options |  `(get) heights` / `(set) heights = [height, optionHeight]` | Heights in pixels as integers. |

| `data-stretch` | Width ratio relative to master element | `(get/set) stretch` | Number value. |

| `data-placeholder` | Placeholder for internal input | `(get/set) placeholder` | |

| `data-highlight` | Highlight (outline) attached element (boolean flag) | `(get/set) highlight` | |

| `data-highlight-outline` | CSS outline style string | `(get/set) highlightOutline` | Example: `“1px solid green”` |

| `data-multiple` | Multiple selection mode (boolean flag) | `(get/set) multiple` | |

| `data-hidden-input` | Show/hide internal input (boolean flag) | `(get/set) hiddenInput` | |

### 4. CSS Variables for Styling
Customize appearance via CSS variables:

| Variable | Description |

|------------|--------------|

| `--option-background` | Background color of options |

| `--option-color` | Font color of options |

| `--option-font-family` | Font family for options |

| `--option-font-size` | Font size for options |

| `--option-font-weight` | Font weight for options |

| `--option-border-radius` | Border radius of options |
___
| `--option-hover-background` | Background color for options on hover |

| `--option-hover-color` | Font color for options on hover |

| `--option-select-background` | Background for selected options |

| `--option-select-color` | Font color for selected options |
___
| `--delete-color` | Font color for delete block |

| `--delete-background` | Background for delete block |

| `--delete-font-size` | Font size for delete symbol |
___
| `--delete-hover-color` | Font color on delete hover |

| `--delete-hover-background` | Background on delete hover |
___
| `--drop-z-index` | z-index of the dropdown container (defaults to 99) |

| `--drop-background` | Background color of dropdown container |

| `--drop-border` | Border style of dropdown container |

| `--drop-border-radius` | Border radius of dropdown container |

| `--drop-box-shadow` | Shadow for dropdown container |
___
| `--input-border-bottom` | Bottom border of internal input |

| `--input-background-color` | Background color of internal input |

| `--input-color` | Font color of internal input |

| `--input-font-family` | Font family of internal input |

| `--input-font-size` | Font size of internal input |

| `--input-font-weight` | Font weight of internal input |
___
| `--input-placeholder-color` | Color for placeholder’s font |

| `--input-placeholder-font` | Font family for placeholder |

| `--input-placeholder-font-size` | Font size for placeholder |

| `--input-placeholder-font-weight` | Font weight for placeholder |
