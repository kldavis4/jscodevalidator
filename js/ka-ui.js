/*global define, ace */
/*jslint plusplus: true */
define(['jquery', 'ka-validator'], function ($, validator) {
    'use strict';

    var editor,
        alerts,
        messagesBox,
        requiredElements = [],              //Required code elements
        disallowedElements = [],            //Disallowed code elements
        structuralRules,                    //Structural Rules
        structuralOptions = {strict: true}, //Structural rule options
        //ESTree Spec Statements & Declarations
        ESTREE_STATEMENTS = ['Expression', 'Block', 'Empty', 'Debugger', 'With', 'Return', 'Labeled',
                            'Break', 'Continue', 'If', 'Switch', 'Throw', 'Try', 'While', 'DoWhile',
                            'For', 'ForIn'],
        ESTREE_DECLARATIONS = ['Function', 'Variable'];

    /**
     * Refreshes the contents of the message box with the current
     * set of alert messages. Handles de-duplication of errors.
     */
    function updateMessagesBox() {
        messagesBox.val(alerts.map(function (alert) { //process alerts into message strings
            var msg;
            switch (alert.type) {
            case validator.alertTypes.REQUIRED:
                msg = alert.nodeType + ' Is Needed';
                break;
            case validator.alertTypes.DISALLOWED:
                msg = alert.nodeType + ' Is Not Allowed';
                break;
            case validator.alertTypes.STRUCTURAL:
                msg = alert.message;
                break;
            case validator.alertTypes.PARSER_ERROR:
                msg = alert.message;
                break;
            }
            return msg;
        }).sort().filter(function (value, index, arr) { //remove duplicates
            if (index < 1) {
                return true;
            }
            return value !== arr[index - 1];
        }).reduce(function (prev, cur) { //reduce array of messages to single string
            if (cur) {
                return prev + cur + '\n';
            }
            return prev;
        }, ''));
    }

    /**
     * Handler for validation alert callbacks. Adds them to the alerts
     * collection and then updates the message box.
     */
    function handleValidationAlerts(data) {
        var i;
        if (data && data.length) {
            for (i = 0; i < data.length; i++) {
                alerts.push(data[i]);
            }
        }

        updateMessagesBox();
    }

    /**
     * Execute all validation requests for the current script content
     */
    function validate() {
        //Clear existing messages
        alerts = [];

        var script = editor.getValue();

        validator.evaluateRequired(script, requiredElements);

        validator.evaluateDisallowed(script, disallowedElements);

        validator.evaluateStructural(script, structuralRules, structuralOptions);
    }

    /**
     * Makes handler function for the required / disallowed elements checkbox
     * When checked, that code element type gets added to the specified list.
     * @param {Object[]} The code elements list to add/remove elements from.
     * @param {string} The code element type to add/remove (eg. 'IfStatement')
     * @param {Object} The JQuery object for the checkbox
     */
    function makeElementsCheckboxHandler(elements, elementType, checkbox) {
        return function () {
            var elementIdx = elements.indexOf(elementType);
            if (checkbox.is(':checked')) {
                if (elementIdx === -1) {
                    elements.push(elementType);
                }
            } else {
                if (elementIdx !== -1) {
                    elements.splice(elementIdx, 1);
                }
            }

            validate();
        };
    }

    /**
     * Makes the required & disallowed code elements checkboxes for the given code element type
     * @param {string} The code element type (eg. 'IfStatement')
     * @param {Object} The JQuery dom element of the required code elements panel
     * @param {Object} The JQuery dom element of the disallowed code elements panel
     */
    function makeCheckboxes(elementType, requiredControlPanel, disallowedControlPanel) {
        var checkbox = $('<input type=\'checkbox\'/>');
        checkbox.on('change',
                    makeElementsCheckboxHandler(requiredElements,
                                                elementType,
                                                checkbox));
        requiredControlPanel.append(checkbox);
        requiredControlPanel.append($('<span class="element-checkbox-label">' + elementType + '</span><br />'));

        checkbox = $('<input type=\'checkbox\'/>');
        checkbox.on('change',
                    makeElementsCheckboxHandler(disallowedElements,
                                                elementType,
                                                checkbox));
        disallowedControlPanel.append(checkbox);
        disallowedControlPanel.append($('<span class="element-checkbox-label">' + elementType + '</span><br />'));
    }

    return {
        /**
         * Initialize the UI for the validator demo
         */
        init: function () {
            var i,
                requiredControlPanel,
                disallowedControlPanel;

            //Register a listener for validation alerts
            validator.registerAlertListener(handleValidationAlerts);

            //Setup the message box
            messagesBox = $('#messages');
            messagesBox.prop('disabled', true);

            //Setup the editor
            editor = ace.edit('editor');
            editor.setTheme('ace/theme/monokai');
            editor.getSession().setMode('ace/mode/javascript');
            editor.getSession().on('change', function () {
                validate();
            });

            requiredControlPanel = $('#required-elements-panel');
            disallowedControlPanel = $('#disallowed-elements-panel');

            //Setup checkboxes for declaration code elements
            for (i = 0; i < ESTREE_DECLARATIONS.length; i++) {
                makeCheckboxes(ESTREE_DECLARATIONS[i] + 'Declaration',
                               requiredControlPanel,
                               disallowedControlPanel);
            }

            //Setup checkboxes for statement code elements
            for (i = 0; i < ESTREE_STATEMENTS.length; i++) {
                makeCheckboxes(ESTREE_STATEMENTS[i] + 'Statement',
                               requiredControlPanel,
                               disallowedControlPanel);
            }

            //Setup the input for general structural rules
            structuralRules = JSON.parse($('#structural-rules-input').val());
            $('#structural-rules-input').on('change', function () {
                try {
                    structuralRules = JSON.parse($('#structural-rules-input').val());
                } catch (e) {
                    structuralRules = {};
                }
                validate();
            });

            //Setup the input for the strict structural rules option
            $('#structural-option-strict').on('change', function () {
                structuralOptions.strict = this.checked;
                validate();
            });
        }
    };
});
