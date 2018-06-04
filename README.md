
**About:**

[Gilab issue importer](https://github.com/mastercoder82/gitlab-issue-import) project on [Hasura](https://hasura.io/) platform. Uses Hasura [nodejs-express](https://github.com/hasura/hello-nodejs-express) template. 

**Instructions to deploy app:**

1. Use below command to clone [base repository](https://github.com/hasura/hello-nodejs-express) and create Hasura cluster: 
`hasura quickstart hasura/hello-nodejs-express`
2. Replace the contents of `/microservices/api/src` with the respective folder of this repository. 
3. Edit the file `/microservices/api/src/config.js` to put Hasura cluster name and admin token. 
4. Run `git add .`, `git commit`, and `git push hasura master`.
5. Setup sending emails using [Hasura Test Provider](https://docs.hasura.io/0.15/manual/notify/email/hasura-test-provider.html). 


**Instructions to use app:**

1. Go to `https://api.<cluster-name>.hasura-app.io/`
2. Fill the form with below values: 
	- Gitlab Project ID - can be found at "Project Settings/General" on Gitlab. 
	- Access Token - Create it in the "User Settings/Access Tokens" menu on Gitlab and set the scope to API. 
	- Issues file - csv file with columns in this order - "title", "description", "assignee", "milestone", "labels". 
	- Email ID - to receive notification on task completion. 
3. Click on submit. 
4. After some time, you should get email notification and new issues should have been created in Gitlab project.

**Demo:** 

https://api.mulligatawny40.hasura-app.io/ 