# Credits

Updated from [serverless-spa](https://www.serverless.com/plugins/serverless-spa)

### yaml options

* distribution options are optional
* bucket name options are recommended

```yaml
custom:
  spa:
    path: pathToSpaBuild
    bucketDev: name of s3 bucket to sync to
    distributionDev: cloudfront distribution ID
    bucketProd: name of s3 bucket to sync to
    distributionProd: cloudfront distribution ID

```

### yaml example
```yaml
custom:
  spa:
    path: ../client/build
    bucketDev: app-webapp-dev
    distributionDev: D39SDFKDSLJFDS
    bucketProd: app-webapp-prod
    distributionProd: D5SKDJKFLSJDF
```
