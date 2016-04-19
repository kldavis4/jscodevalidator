/*global requirejs, require */
requirejs.config({
    appDir: ".",
    baseUrl: "js",
    paths: {
        /* Load jquery from google cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min', 'jquery-min'],
        'ace': ['//cdnjs.cloudflare.com/ajax/libs/ace/1.2.3/ace', 'ace'],
        'acorn' : ['acorn'],
        'walk' : ['walk'],
        'ka-validator': ['ka-validator'],
        'ka-ui' : ['ka-ui']
    },
    shim: {
        'ka-ui' : ['ace']
    }
});

require(['ka-ui'], function (ui) {
    "use strict";

    ui.init();
    return {};
});
