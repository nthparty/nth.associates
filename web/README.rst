nth.associates/web
==================

In-browser secure collaboration and enrichment tool for tabular data.

Development and Build Environment
---------------------------------

The build environment must have Python 3.8 or higher and Node.js installed. Once these are available in the environment, it is sufficient to run ``npm install`` to prepare the environment for building the application.

Build Procedure for Deployment
------------------------------

To build a version of the application that is ready for distribution and deployment, run the following::

    python build.py

It is possible to specify a configuration file for a particular application instance, as well. The example below assumes a configuration file ``cfg/nth.associates.json`` exists. The JSON object in this file will be the argument provided to the application object constructor in the ``dist/index.html`` file emitted by the build process::

    python build.py nth.associates

Once the build process is complete, all the necessary files (ready to be posted to a publicly accessible server directory) can be found in ``dist/``.

Local Testing
-------------

To deploy and test locally, there are two options: using a custom server of your choice or using the testing script.

Custom Server
^^^^^^^^^^^^^

Execute the build procedure and copy the files to a directory or subdirectory from which files can be accessed using a web browser.

Local Testing Script
^^^^^^^^^^^^^^^^^^^^

It is possible to use the provided Flask app found in ``build_test.py`` for local testing. However, note that this script **executes a build procedure**, overwriting anything already present in ``dist/``::

    python build_test.py

It is possible to specify a configuration file for a particular application instance, as well. The example below assumes a configuration file ``cfg/nth.associates.json`` exists::

    python build_test.py nth.associates

Accessing the Running Application
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Assuming that by some other means or via the script above the files are now accessible at ``http://localhost:5000/``, load ``http://localhost:5000/index.html`` in the browser to see the default landing page.
