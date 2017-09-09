var path = require('path');

module.exports = {
    entry: "./tests/test", // string | object | array
    // Here the application starts executing
    // and webpack starts bundling

    output: {
        // options related to how webpack emits results

        path: path.resolve(__dirname, "tests"), // string
        // the target directory for all output files
        // must be an absolute path (use the Node.js path module)

        filename: "bundle.js", // string
        // the filename template for entry chunks

        publicPath: "/", // string
        // the url to the output directory resolved relative to the HTML page

        library: "PubSubATests", // string,
        // the name of the exported library

        libraryTarget: "umd", // universal module definition
        // the type of the exported library

    },
    module: {
        // configuration regarding modules

        rules: [
            // rules for modules (configure loaders, parser options, etc.)

            {
            }
        ]
    },
    resolve: {
        // options for resolving module requests
        // (does not apply to resolving to loaders)

        modules: [
            "node_modules",
            path.resolve(__dirname, "src"),
        ],
        // directories where to look for modules

        extensions: [".js"],
        // extensions that are used
    },
    // devtool: "source-map",
    // devtool makes only sense if we use ts-loader & co.

    context: __dirname, // string (absolute path!)
    // the home directory for webpack
    // the entry and module.rules.loader option
    //   is resolved relative to this directory

    target: "web", // enum
    // the environment in which the bundle should run
    // changes chunk loading behavior and available modules
}


