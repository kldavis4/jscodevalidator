# Javascript Code Validator Demo

## Overview

This project demonstrates the use of a simple Javascript code validation library (`js/ka-validator.js`) that uses Acorn.js to parse code and evaluate the code against whitelist, blacklist and general structural rules.

## Functionality

Javascript code can be entered directly in the editor. Validation checks are configured in the right hand control panel. Code element types for whitelist / blacklist can be selected. General structural rules can be input as well. Validation occurs automatically and validation error messages are displayed in the textarea at the top of the panel.

## Validator API Docs

### `evaluateRequired(script, nodeTypes)`

The evaluateRequired() method takes the following parameters:

* script - a string containing the Javascript code to evaluate
* nodeTypes - a string or array of strings containing the node types to require. Node type names must match those specified in the [ESTree specification](https://github.com/estree/estree).

### `evaluateDisallowed(script, nodeTypes)`

The evaluateDisallowed() method takes the following parameters:

* script - a string containing the Javascript code to evaluate
* nodeTypes - a string or array of strings containing the node types to disallow (or blacklist). Node type names must match those specified in the [ESTree specification](https://github.com/estree/estree).

### `evaluateStructural(script, rules, options)`

The evaluateStructural() method takes the following parameters:

* script - a string containing the Javascript code to evaluate
* rules - an Object or array of Objects containing a rule tree conforming to the [ESTree specification](https://github.com/estree/estree).
* options - an optional Object containing option fields for the structural evaluation. Currently the only option is `strict: true|false`. When set to true, the structure specified in the rule must be matched exactly. When set to false, the structure only requires a loose fit.

#### Structural Rule Format

Structural rules are specified in JSON format. The top-level of the rule should contain two fields `message` and `rule`. The message field should contain the message to set on the alert that is generated when the rule validation fails. The rule field should contain an object corresponding to the ESTree specification Abstract Syntax Tree to match. See examples below for valid rule definition objects.

#### Option `strict:true` 

##### Example 1

Code:

    if (true) {
      for (var i=0; i<10; i++) {
      }
    }

Rule:

    {  
       "message":"For Statement Nested Within If Statement Needed",
       "rule":{  
          "type":"Program",
          "body":[  
             {  
                "type":"IfStatement",
                "consequent":{  
                   "type":"BlockStatement",
                   "body":[{  
                      "type":"ForStatement"
                   }]
                }
             }
          ]
       }
    }

Result: No alerts

##### Example 2
Code:

    if (true) {
      if (true) {
        for (var i=0; i<10; i++) {
        }
      }
    }

Rule:

    {  
       "message":"For Statement Nested Within If Statement Needed",
       "rule":{  
          "type":"IfStatement",
          "consequent":{  
             "type":"BlockStatement",
             "body":[{  
                "type":"ForStatement"
             }]
          }
       }
    }

Result: Alert message 'For Statement Nested Within If Statement Needed'

#### Option `strict:false` 

##### Example 1
Code:

    if (true) {
      if (true) {
        for (var i=0; i<10; i++) {
        }
      }
    }

Rule:

    {  
       "message":"For Statement Nested Within If Statement Needed",
       "rule":{  
          "type":"IfStatement",
          "consequent":{  
             "type":"BlockStatement",
             "body":[{  
                "type":"ForStatement"
             }]
          }
       }
    }

Result: No Alerts

### Receiving Validation Results - `registerAlertListener`

All validation methods return alert results via a callback method that is registered via `registerAlertListener`. This method takes a callback function. Alerts are passed as an array of validation alert objects to the callback function.

### Alert objects

Alert objects consist of a `type` field and either a `nodeType` or `message` field.

Alert types are:

* `parsererror` - For parser related errors. `message` field will contain the parser exception message.
* `required` - For required validation errors. `nodeType` contains the type of the missing AST node.
* `disallowed` - For disallowed validation errors. `nodeType` contains the type of the blacklisted and present AST node.
* `structural` - For structural validation errors. `message` field will contain the corresponding structural rule validation error message (defined in the rule object).

## Web Workers

The validation library will optionally use the Web Worker API if it is available for parsing code and evaluating rules.

## Javascript Parser

Javascript code is parsed using the [Acorn.js](https://github.com/ternjs/acorn) Javascript library. This library was chosen over Esprima for it's small size and (slightly) better performance. The accompanying `walk` abstract syntax tree walker is used to find nodes for whitelist/blacklist API methods.

## Browser Compatibility

The API and demo should be compatible with the most recent versions of Chrome, Safari, Firefox and IE10+.

## Future Work

There is some functionality / features that I would like to see added at some point:

 * Unit tests for the validator should be written
 * Currently the structural validation rules don't allow specifying a number of code elements required at a given level in the AST. For example, if the rule specifies two `IfStatement` nodes in a `BlockStatement` body and the code only includes one, then the validation rule is passed.
 * At least for disallowed, it would be good if the alert included the location of the blacklisted code element. It may also be possible to return the locations of the matching code elements for structural rules to allow the user to identify where the validation is failing.
 * In the demo UI, not all ESTree code element types are presented as options in the required/disallowed lists