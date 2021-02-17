# nth.associates/cloud-aws-ec2
Browser-compatible client-side component and AWS-compatible service-side component for the nth.associates data association and enrichment service.

## Testing

The test script can generate sample data when it is invoked. It accepts an optional integer parameter indicating the number of rows that the client-side and service-side data sets will contain.
```bash
python test.py 1000
```

## Deployment

Copy the contents of this directory together with `nthassociates.py` (from the root directory of this repository) onto a server instance. The service can then be started as shown below.
```bash
python service.py
```
Navigate to `http://<server>:8080/index.html` using a web browser to interact with the service using the browser-based client interface.
