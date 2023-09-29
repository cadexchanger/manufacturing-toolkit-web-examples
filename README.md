# Examples of web apps for Manufacturing

This repository contains examples of web apps using [Manufacturing Toolkit](https://cadexchanger.com/products/sdk/add-ons/manufacturing-toolkit/) and [CAD Exchanger Web Toolkit](https://cadexchanger.com/products/sdk/add-ons/web-toolkit/).

You can find overview of available examples and detailed tutorials of how to create CAD Exchanger Web Toolkit based web application that retrieve and show manufacturing data [here](https://docs.cadexchanger.com/mtk/mtk_tutorials_page.html).

The examples are provided under a permissive Modified BSD License. You may insert their source code into your application and modify as needed.

## Requirements

* Latest version of CAD Exchanger SDK
* Latest version of Manufacturing Toolkit
* Node.js 16 or higher

## Running

To use the examples, first obtain the MTK evaluation [here](https://cadexchanger.com/contact-us/licensing-inquiry/). Please describe your use case in detail. Upon filling out the form you'll receive an email with an evaluation license key for SDK (`cadex_license.*` file) and MTK (`mtk_license.*` file). There will also be links to the latest CAD Exchanger SDK and MTK packages. You can also register in our [Customer Corner](https://my.cadexchanger.com/) and see both the license key and the link there.

1. Install Node.js 16 or higher (if it hasn't been installed yet).

2. Install the Manufacturing Toolkit Converter into `converter` folder inside concrete example using [this](https://docs.cadexchanger.com/mtk/mtk_install_page.html#mtk_quick_start_installation_converter) instruction. The `converter` folder should be placed inside each example, e.g. `..\Sheet Metal example\converter\`.

3. Open a terminal in concrete example folder (e.g. `..\Sheet Metal example\`) and type:
    ```
    npm install
    npm start
    ```
    These commands will install the npm package locally and start the development server.

4. Open example in browser. By default, the examples will be available [here](http://localhost:3000). If necessary, you can change the port by editing the params inside the `app.js` file.

## Learn more

If you'd like to learn more about CAD Exchanger, visit our [website](https://cadexchanger.com/). If you have any questions, please reach out to us [here](https://cadexchanger.com/contact-us/).
