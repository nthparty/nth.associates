# nth.associates
Client-side and service-side components for a secure data association and enrichment service.

## Description and Purpose

The **nth.associates** library enables the assembly of applications that facilitate *secure data enrichment* workflows in which data sets can be extended and appended based on their content without that content being revealed at any point. This is accomplished via a combination of [private set intersection](https://en.wikipedia.org/wiki/Private_set_intersection) protocols (based on elliptic curve operations) and [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing).

## Overview of Components 

This repository consists of the core library and two template applications: one intended for deployment on AWS EC2 and allowing enrichment using large-scale data sets hosted in the cloud (*i.e.*, on AWS EC2), and one intended as a lightweight web-based tool in which the data contributions from both sides are browser-scale.

    ├─ nthassociates.py ....... Core library
    ├─ requirements.txt ....... Dependencies
    ├─ README.md .............. Overview and documentation
    │
    └─ web/ ................... Lightweight application for browsers
    └─ cloud-aws-ec2/ ......... Cloud-based application for for EC2

## Conventions

Style conventions are enforced using [Pylint](https://www.pylint.org/):
```bash
pylint nthassociates
```

## Reporting and Contributions

Bug reports, feature requests, and support requests should be submitted via [GitHub Issues](https://github.com/nthparty/nth.associates/issues) for this repository. Pull requests can be used to suggest improvements and fixes. However, due to the fact that the source code in this repository is transpiled and compiled from other repositories, it is preferable that pull requests be issued directly to the upstream repositories.

## Versioning and Releases

Beginning with version 0.1.0, the version number format for **nth.associates** and the changes to the library associated with version number increments will conform with [Semantic Versioning 2.0.0](https://semver.org/#semantic-versioning-200).

**nth.associates** releases will be managed using this GitHub repository in the [usual manner](https://help.github.com/en/github/administering-a-repository/managing-releases-in-a-repository), such that:
* the commit corresponding to a release will be tagged, a corresponding release will be created, and the tag will be associated with that release; and
* within each **nth.associates** release, the dependencies in the `requirements.txt` file will be locked to the latest versions available that are compatible with -- and that have been tested successfully with -- that **nth.associates** release.
