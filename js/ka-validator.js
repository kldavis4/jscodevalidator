/*global define, Node, WorkerGlobalScope, Worker, self */
/*jslint plusplus: true */
(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['acorn', 'walk'], factory);
    } else {
        // Browser globals
        root.validator = factory(root.acorn, root.walk);
    }
}(this, function (acorn, walk) {
    'use strict';

    var alertListener,
        alertTypes = {
            REQUIRED: 'required',
            DISALLOWED: 'disallowed',
            PARSER_ERROR: 'parsererror',
            STRUCTURAL: 'structural'
        },
        //true if this script is executing in a worker
        isWorker = (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope),
        //web worker object - if not in a worker script
        worker = isWorker ? undefined : new Worker('js/ka-validator-worker.js');

    //Register a listener for worker messages if
    //not in a worker script
    if (!isWorker) {
        worker.addEventListener('message', function (e) {
            if (alertListener) {
                alertListener(JSON.parse(e.data));
            }
        }, false);
    }
    
    /**
     * Checks if the AST has the specified node type
     * @param {Object} ast - The Abstract Syntax Tree object created by the parseCode method
     * @param {string} nodeType - The node type being searched for (eg. 'IfStatement')
     * @return {Object|boolean} returns the node or falsy value if not found
     */
    function hasNodeType(ast, nodeType) {
        if (ast) {
            return walk.findNodeAt(ast, null, null, nodeType);
        } else {
            return false;
        }
    }

    /**
     * Recursive method to check if a given node in the AST matches a given
     * node in a Rule tree object. Takes an options object and currently only
     * supports the strict: true|false option. If strict is false, then if a
     * rule node doesn't match a given node in the AST, each possible child of
     * that node in the AST will be tested against the given rule node. This
     * allows more flexible rule structures at the cost of more node comparisons.
     * @param {Object} astNode - An AST Node object to compare
     * @param {Object} ruleNode - A Rule tree object node to check
     * @param {Object} options - The options object to use
     */
    function compareNodeToStructuralRule(astNode, ruleNode, options) {
        var memberName,
            i,
            j,
            found,
            mismatch = false,
            member;

        //Rule node type doesn't match the AST node type
        if (ruleNode.type !== astNode.type) {
            mismatch = true;
        } else {
            //Consider all the members in the rule node
            for (memberName in ruleNode) {
                //Exclude type member & prototype members
                if (ruleNode.hasOwnProperty(memberName) && memberName !== 'type') {
                    //Member value is array
                    if (Array.isArray(ruleNode[memberName])) {
                        //If ast member value is not array declare mismatch
                        if (!Array.isArray(astNode[memberName])) {
                            mismatch = true;
                            break;
                        }

                        //Iterate over the array in the rule
                        //Find a match for the given type in the AST member values
                        for (i = 0; i < ruleNode[memberName].length; i++) {
                            found = false;
                            for (j = 0; j < astNode[memberName].length; j++) {
                                //On a match, descend and check the next level
                                if (ruleNode[memberName][i].type === astNode[memberName][j].type) {
                                    if (compareNodeToStructuralRule(astNode[memberName][j], ruleNode[memberName][i], options)) {
                                        found = true;
                                        break;
                                    }
                                }
                            }

                            //If none of the member value types matches the member rule type
                            //declare mismatch
                            if (!found) {
                                mismatch = true;
                                break;
                            }
                        }

                        if (mismatch) {
                            break;
                        }
                    } else {
                        //If rule member value is not array and ast node member is array
                        //declare a mismatch
                        if (Array.isArray(astNode[memberName])) {
                            mismatch = true;
                            break;
                        }
                        
                        //Compare child nodes
                        if (!compareNodeToStructuralRule(astNode[memberName], ruleNode[memberName], options)) {
                            mismatch = true;
                            break;
                        }
                    }
                }
            }
        }

        //If strict = false and mismatch occurred, look for all paths down from the current AST
        //node and re-check the current rule node against those paths
        if (mismatch && !options.strict) {
            for (memberName in astNode) {
                if (astNode.hasOwnProperty(memberName)) {
                    member = astNode[memberName];
                    if (member) {
                        if (Array.isArray(member)) {
                            for (i = 0; i < member.length; i++) {
                                if (compareNodeToStructuralRule(member[i], ruleNode, options)) {
                                    return true;
                                }
                            }
                        } else if (member.type) {
                            if (compareNodeToStructuralRule(member, ruleNode, options)) {
                                return true;
                            }
                        }
                    }
                }
            }
        } else {
            return !mismatch;
        }
    }
    
    /**
     * Parses the specified code returning an Abstract Syntax Tree object. If there is
     * an exception, an alert object is added to the alerts collection parameter and
     * undefined is returned.
     * @param {string} script - the javascript code to parse
     * @param {Object[]} alerts - the alerts object where any parsing errors are placed
     */
    function parseCode(script, alerts) {
        try {
            return acorn.parse(script);
        } catch (e) {
            alerts.push({
                type: alertTypes.PARSER_ERROR,
                message: e.message
            });
        }
        return undefined;
    }

    /**
     * Registers callback function to receive validation alerts. Any previously registered
     * callback function will be replaced.
     *
     * @param {function} callback function to register.
     */
    function registerAlertListener(listener) {
        alertListener = listener;
    }

    /**
     * Performs validation of a given structural rule with the specified options
     * on the specified Abstract Syntax Tree.
     * @param {Object} ast - the abstract syntax tree object generated by the parser
     * @param {Object} rule - the rule object containing the desired code structure
     * @param {Object} [options] - an optional options object containing a set of options
     * to use in the structural validation. Currently only strict: true|false is supported.
     */
    function evaluateStructuralRule(ast, rule, options) {
        if (rule) {
            return compareNodeToStructuralRule(ast, rule, options || {strict: true});
        } else {
            return true;
        }
    }
    
    /**
     * Performs validation of the given javascript code checking that all the
     * node types specified in nodeTypes are present. For any node types not
     * present in the javascript code, an alert object will be created and added to
     * a list of alerts. The alert object will consist of a boolean required=true 
     * field and a string type field. If the javascript cannot be parsed, a single
     * alert with the parser error message will be returned.
     *
     * @param {string} script - The javascript code string
     * @param {(string|string[])} nodeTypes - The node type or types that must exist in the code
     * @returns {Array} Array of all alert objects generated by the validation.
     */
    function evaluateRequired(script, nodeTypes) {
        var i,
            ast,
            alerts = [];

        ast = parseCode(script, alerts);

        if (ast && nodeTypes) {
            if (Array.isArray(nodeTypes)) {
                for (i = 0; i < nodeTypes.length; i++) {
                    if (!hasNodeType(ast, nodeTypes[i])) {
                        alerts.push({
                            type: alertTypes.REQUIRED,
                            nodeType: nodeTypes[i]
                        });
                    }
                }
            } else {
                if (!hasNodeType(ast, nodeTypes)) {
                    alerts.push({
                        type: alertTypes.REQUIRED,
                        nodeTpe: nodeTypes
                    });
                }
            }
        }

        return alerts;
    }
    
    /**
     * Performs validation of the given javascript code checking that all the
     * node types specified in nodeTypes are not present. For any node types
     * present in the javascript code, an alert object will be created and added to
     * a list of alerts. The alert object will consist of a boolean disallowed=true 
     * field and a string type field. If the javascript cannot be parsed, a single
     * alert with the parser error message will be returned.
     *
     * @param {string} script - The javascript code string
     * @param {(string|string[])} nodeTypes - The node type or types that must exist in the code
     * @returns {Array} Array of all alert objects generated by the validation.
     */
    function evaluateDisallowed(script, nodeTypes) {
        var i,
            ast,
            alerts = [];

        ast = parseCode(script, alerts);

        if (ast && nodeTypes) {
            if (Array.isArray(nodeTypes)) {
                for (i = 0; i < nodeTypes.length; i++) {
                    if (hasNodeType(ast, nodeTypes[i])) {
                        alerts.push({
                            type: alertTypes.DISALLOWED,
                            nodeType: nodeTypes[i]
                        });
                    }
                }
            } else {
                if (hasNodeType(ast, nodeTypes)) {
                    alerts.push({
                        type: alertTypes.DISALLOWED,
                        nodeType: nodeTypes
                    });
                }
            }
        }
        
        return alerts;
    }
    
    /**
     * Performs validation of the given javascript code checking that all the
     * structural rules specified in the rules parameter are present. For any rules
     * that do not pass in the javascript code, an alert object will be created and added to
     * a list of alerts. The alert object will consist of a message 
     * field. If the javascript cannot be parsed, a single alert with the parser 
     * error message will be returned.
     *
     * @param {string} script - The javascript code string
     * @param {(Object|Object[])} rules - The structural rule or rules to check
     * @returns {Array} Array of all alert objects generated by the validation.
     */
    function evaluateStructural(script, rules, options) {
        var i,
            ast,
            alerts = [];

        ast = parseCode(script, alerts);

        if (ast && rules) {
            if (Array.isArray(rules)) {
                for (i = 0; i < rules.length; i++) {
                    if (!evaluateStructuralRule(ast, rules[i].rule, options)) {
                        alerts.push({
                            type: alertTypes.STRUCTURAL,
                            message: rules[i].message
                        });
                    }
                }
            } else {
                if (!evaluateStructuralRule(ast, rules.rule, options)) {
                    alerts.push({
                        type: alertTypes.STRUCTURAL,
                        message: rules.message
                    });
                }
            }
        }

        return alerts;
    }

    if (isWorker) {
        //Worker listens for messages from main script
        //and performs the evaluation specified by the job property on the request
        //and posts the alerts object back to the main script
        self.addEventListener('message', function (e) {
            if (e.data) {
                var request = JSON.parse(e.data); //parse the json request

                if (request.job) {
                    switch (request.job) {
                    case 'evaluateRequired':
                        self.postMessage(JSON.stringify(evaluateRequired(request.script, request.nodeTypes)));
                        break;
                    case 'evaluateDisallowed':
                        self.postMessage(JSON.stringify(evaluateDisallowed(request.script, request.nodeTypes)));
                        break;
                    case 'evaluateStructural':
                        self.postMessage(JSON.stringify(evaluateStructural(request.script, request.rules, request.options)));
                        break;
                    }
                }
            }
        }, false);

        //Worker doesn't expose any functions
        return {};
    } else {
        if (!window.Worker) {
            //Worker API is not available so the API functions perform
            // validation directly using the API implementations of
            // the evaluate methods
            return {
                alertTypes: alertTypes,
                registerAlertListener: registerAlertListener,

                evaluateRequired: function (script, nodeTypes) {
                    if (alertListener) {
                        alertListener(evaluateRequired(script, nodeTypes));
                    }
                },

                evaluateDisallowed: function (script, nodeTypes) {
                    if (alertListener) {
                        alertListener(evaluateDisallowed(script, nodeTypes));
                    }
                },

                evaluateStructural: function (script, rules, options) {
                    if (alertListener) {
                        alertListener(evaluateStructural(script, rules, options));
                    }
                }
            };
        } else {
            //If Worker API is available the same API functions are returned but
            // are not implemented directly and will write JSON job requests to 
            // the worker instead of performing the evaluation directly
            return {
                alertTypes: alertTypes,
                registerAlertListener: registerAlertListener,

                evaluateRequired: function (script, nodeTypes) {
                    worker.postMessage(JSON.stringify({job: 'evaluateRequired', script: script, nodeTypes: nodeTypes}));
                },

                evaluateDisallowed: function (script, nodeTypes) {
                    worker.postMessage(JSON.stringify({job: 'evaluateDisallowed', script: script, nodeTypes: nodeTypes}));
                },

                evaluateStructural: function (script, rules, options) {
                    worker.postMessage(JSON.stringify({job: 'evaluateStructural', script: script, rules: rules, options: options}));
                }
            };
        }
    }
}));