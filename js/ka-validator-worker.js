/*global requirejs, require, importScripts */
importScripts('require.js');

requirejs.config({
    paths: {
        'ka-validator': ['ka-validator'],
        'acorn' : ['acorn'],
        'walk' : ['walk']
    }
});

require(['ka-validator'], function () {
    'use strict';
    return {};
});
