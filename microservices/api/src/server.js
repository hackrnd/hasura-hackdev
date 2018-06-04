
  // RUN PACKAGES
  const express = require('express');
  const multer = require('multer');
	const bodyParser = require('body-parser');
	const child_process = require('child_process');
	

  // SETUP APP
  const app = express();
  const port = 8080;
  app.use(bodyParser.urlencoded({extended:false}));
  app.use(bodyParser.json());
  app.use('/', express.static(__dirname + '/public'));


  const multerConfig = {

    //specify diskStorage (another option is memory)
    storage: multer.diskStorage({

      //specify destination
      destination: function(req, file, next){
        next(null, __dirname + '/uploads');
      },

      //specify the filename to be unique
      filename: function(req, file, next){
        console.log(file);
        next(null, 'file-' + Date.now());
      }
    }),

    // filter out and prevent non-csv files.
    fileFilter: function(req, file, next){
          if(!file){
            next();
          }

        // only permit image mimetypes
        const image = file.originalname.endsWith('.csv');
        if(image){
          console.log('file uploaded');
          next(null, true);
        }else{
          console.log("file not supported")
          next(new Error('Please upload csv file. Other file types not supported.'))
        }
    }
	};
	
	var upload = multer(multerConfig).single('file');


  /* ROUTES
  **********/

  app.get('/', function(req, res){
		res.send('index.html');
	});
	
	app.post('/upload', function (req, res) {
		upload(req, res, function (err) {
			if (err) {
				return res.end("Error uploading file: " + err.message);  
			}

			var msg = req.body;
			msg.taskId = req.file.filename.split('-')[1];
      //var child = child_process.fork(__dirname + '/worker.js',[],{execArgv:['--inspect']});
      var child = child_process.fork(__dirname + '/worker.js');
			child.send(msg);
			
			res.send('File uploaded successfully! You will be notified on your email once task is complete. Task ID: ' + msg.taskId);
		})
	});

  // RUN SERVER
  app.listen(port,function(){
    console.log(`Server listening on port ${port}`);
  });
