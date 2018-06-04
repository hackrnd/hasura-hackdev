const gitlab = require('node-gitlab');
const json2csv = require('json2csv');
const csv2array = require("csv-to-array");
const fs = require('fs');
const request = require('request');
const config = require('./config');

const columns = ["title", "description", "assignee", "milestone", "labels"];

var options = {
    // Create a Personal Access Token in the "User Settings/Access Tokens"
    // menu on Gitlab and set the scope to API.
    privateToken: 'xxxxxxxxxxxxx',

    // THe project ID for the issues
    // This can be found at "Project Settings/General"
    // and Expand the "General Project Settings" section
    projectId: 111111,

    email: '',

    // The API throws a 500 error when the calls come too fast.
    // This is a quick and dirty way to delay them by a .5 seconds for each post request.
    timeoutValue: 500,

    // When creating the CSV, it is easier to use nicknames for the assignees.
    // To accomodate this, I now define an object with the nicknames and their
    // associate user IDs. To get the your user ids, log in to gitlab and use the following link
    // https://gitlab.com/api/v4/users?username=YOUR_USER_NAME
    assigneeNicknames: {
        John: 111111,
        Chris: 222222
    },

    taskId: 0
};

var client;

process.on('message', function (message) {
    // Process data

    options.privateToken = message.token;
    options.projectId = message.projectId;
    options.taskId = message.taskId;
    options.email = message.email;

    client = gitlab.create({
        api: 'https://gitlab.com/api/v3',
        privateToken: options.privateToken
    });

    csv2array({
        file: __dirname + '/uploads/file-' + options.taskId,
        columns: columns
    }, function (err, array) {
        if (err) {
            console.log("CSV NOT LOADED! \n" + err)
        } else {
            array.shift(); // drop the headers
            getMilestones(array);
        }
    });

    //process.send({ id: message.id, data: 'some result' });
});


var loop = 0;
var retries = 0;
var processed = 0;
var failures = [];  // Array to hold all failures for a retry


function clearRetryFile() {
    var file = __dirname + '/uploads/retry-' + options.taskId;
    fs.stat(file, function (err, stats) {
        if (err) {
            return console.error(err);
        }

        fs.unlink(file, function (err) {
            if (err) return console.log(err);
            console.log('Killed the retry file');
        });
    });
}

function clearMainFile() {
    var file = __dirname + '/uploads/file-' + options.taskId;
    fs.stat(file, function (err, stats) {
        if (err) {
            return console.error(err);
        }

        fs.unlink(file, function (err) {
            if (err) return console.log(err);
            console.log('Killed the main file');
        });
    });
}

function createIssue(data) {
    client.issues.create({
        id: options.projectId,
        title: data.title,
        description: data.description,
        assignee_id: data.assignee,
        milestone_id: data.milestoneId,
        labels: data.labels
    }, function (err, success) {
        processed++;
        if (success) {
            console.log("Issue " + data.title + " created!");
        } else {
            console.log(data.title + " NOT CREATED! \n" +
                err + "\n Try upping the timeoutValue in the options object");

            failures.push(data);
            console.log(failures.length + ' failures so far');
            updateRetryFile(data.title);
        }

        if(processed == loop){
            if(retries == 2){
                clearRetryFile(); // Delete retry file
                cleanup();
            }else{
                //retry failed issues
                retries++;
                loop = 0;
                processed = 0;
                failures = [];
                csv2array({
                    file: __dirname + '/uploads/retry-' + options.taskId,
                    columns: columns
                }, function (err, array) {
                    if (err) {
                        console.log("Retry file not present \n" + err);
                        cleanup();
                    } else {
                        array.shift(); // drop the headers
                        clearRetryFile(); // Delete retry file
                        getMilestones(array);
                    }                
                });
            }
        }
    });
}

function cleanup(){
    clearMainFile(); // Delete main file
    sendEmail();
}

function sendEmail(){
    var reqOptions = {
        url: config.notify.url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + config.notify.token,
            'X-Hasura-Role': 'admin'
        },
        body: JSON.stringify({
            "to": options.email,
            "from": "admin@project.com",
            "fromName": "Project Admin",
            "sub": "Gitlab Bulk Issue Creator: Success",
            "text": "Hi, This is to inform you that bulk issue creation with Task Id: " + options.taskId + " is completed successfully.",
            "html": "Hi, <br><br> This is to inform you that bulk issue creation with Task Id: <b>" + options.taskId + "</b> is completed successfully."
        })
    }
    request(reqOptions, function(error, response, body) {
        if (error) {
            console.log("Failed to send email. " + error)
        }else{
            console.log("Email sent successfully");
        }

        process.exit(); // Exit child process
    });
}

function createIssues(data) {
    var length = data.length;
    // Shift the current issue out
    var temp = data.shift();
    if (length) {
        // If there was still at least one object create the issue.
        setTimeout(function () {
            // The timeout is there to prevent conflicts... Ugly but it works
            createIssue(temp);
        }, options.timeoutValue * loop);
        ++loop;
        // Recursivly call this function with the remaining issues
        createIssues(data);
    } else { }
}

function getMilestones(data) {
    var milestoneIds = {};
    // Get a list of the project's milestones
    client.milestones.list({
        id: options.projectId
    }, function (err, milestones) {
        if (err) {
            console.log(err);
        } else {
            for (var i = 0; i < milestones.length; i++) {
                // Once you have the list, standardize the titles and put it into the object
                milestones[i].title = removeChars(milestones[i].title);
                milestoneIds[milestones[i].title] = milestones[i].id;
            }
            // once we have the object lets send to the sanitize function
            sanitizeData(data, milestoneIds);
        }
    });
}

function removeChars(str) {
    // Replace special characters and spaces with underscores
    var newString = str.replace(/[^A-Z0-9]+/ig, "_");
    // Return the name in all lower case
    return newString.toLowerCase();
}

function sanitizeData(data, mIds) {
    var nicknames = {};
    // First lets prep the nickname object by sanitizing our object from options
    for (var key in options.assigneeNicknames) {
        if (options.assigneeNicknames.hasOwnProperty(key)) {
            var name = removeChars(key);
            nicknames[name] = options.assigneeNicknames[key];
        }
    }

    // Now lets loop through the issues
    for (var i = 0; i < data.length; i++) {
        // Sanitize the issue's assignee
        var issueAssignee = removeChars(data[i].assignee);
        // Now lets replace the issue assignee with the ID
        data[i].assignee = nicknames[issueAssignee];
        // Clean the milestones provided by the CSV
        data[i].milestone = removeChars(data[i].milestone);
        // Assign that milestone's associated ID
        data[i].milestoneId = mIds[data[i].milestone];
    }
    // // Send all the issues to a timed loop.
    createIssues(data);
}

function updateRetryFile(title) {
    var csv = json2csv({
        data: failures,
        fields: columns
    });
    fs.writeFile(__dirname + '/uploads/retry-' + options.taskId, csv, function (err) {
        if (err) throw err;
        console.log(title + " added to retry file");
    });
}
