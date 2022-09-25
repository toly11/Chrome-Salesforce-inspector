import {sfConn, apiVersion} from "/inspector.js";

export {copyToClipboard} from "/utils/copyToClipboard.js";
export {initScrollTable} from "/utils/initScrollTable.js";

// @param didUpdate: A callback function to listen for updates to describe data
export function DescribeInfo(spinFor, didUpdate) {
  function initialState() {
    return {
      data: {global: {globalStatus: "pending", globalDescribe: null}, sobjects: null},
      tool: {global: {globalStatus: "pending", globalDescribe: null}, sobjects: null}
    };
  }
  let sobjectAllDescribes = initialState();
  function getGlobal(useToolingApi) {
    let apiDescribes = sobjectAllDescribes[useToolingApi ? "tool" : "data"];
    if (apiDescribes.global.globalStatus == "pending") {
      apiDescribes.global.globalStatus = "loading";
      console.log(useToolingApi ? "getting tooling objects" : "getting objects");
      spinFor(sfConn.rest(useToolingApi ? "/services/data/v" + apiVersion + "/tooling/sobjects/" : "/services/data/v" + apiVersion + "/sobjects/").then(res => {
        apiDescribes.global.globalStatus = "ready";
        apiDescribes.global.globalDescribe = res;
        apiDescribes.sobjects = new Map();
        for (let sobjectDescribe of res.sobjects) {
          apiDescribes.sobjects.set(sobjectDescribe.name.toLowerCase(), {global: sobjectDescribe, sobject: {sobjectStatus: "pending", sobjectDescribe: null}});
        }
        didUpdate();
      }, () => {
        apiDescribes.global.globalStatus = "loadfailed";
        didUpdate();
      }));
    }
    return apiDescribes;
  }
  // Makes global and sobject describe API calls, and caches the results.
  // If the result of an API call is not already cashed, empty data is returned immediately, and the API call is made asynchronously.
  // The caller is notified using the didUpdate callback or the spinFor promise when the API call completes, so it can make the call again to get the cached results.
  return {
    // Returns an object with two properties:
    // - globalStatus: a string with one of the following values:
    //    "pending": (has not started loading, never returned by this function)
    //    "loading": Describe info for the api is being downloaded
    //    "loadfailed": Downloading of describe info for the api failed
    //    "ready": Describe info is available
    // - globalDescribe: contains a DescribeGlobalResult if it has been loaded
    describeGlobal(useToolingApi) {
      return getGlobal(useToolingApi).global;
    },
    // Returns an object with two properties:
    // - sobjectStatus: a string with one of the following values:
    //    "pending": (has not started loading, never returned by this function)
    //    "notfound": The object does not exist
    //    "loading": Describe info for the object is being downloaded
    //    "loadfailed": Downloading of describe info for the object failed
    //    "ready": Describe info is available
    // - sobjectDescribe: contains a DescribeSObjectResult if the object exists and has been loaded
    describeSobject(useToolingApi, sobjectName) {
      let apiDescribes = getGlobal(useToolingApi);
      if (!apiDescribes.sobjects) {
        return {sobjectStatus: apiDescribes.global.globalStatus, sobjectDescribe: null};
      }
      let sobjectInfo = apiDescribes.sobjects.get(sobjectName.toLowerCase());
      if (!sobjectInfo) {
        return {sobjectStatus: "notfound", sobjectDescribe: null};
      }
      if (sobjectInfo.sobject.sobjectStatus == "pending") {
        sobjectInfo.sobject.sobjectStatus = "loading";
        console.log("getting fields for " + sobjectInfo.global.name);
        spinFor(sfConn.rest(sobjectInfo.global.urls.describe).then(res => {
          sobjectInfo.sobject.sobjectStatus = "ready";
          sobjectInfo.sobject.sobjectDescribe = res;
          didUpdate();
        }, () => {
          sobjectInfo.sobject.sobjectStatus = "loadfailed";
          didUpdate();
        }));
      }
      return sobjectInfo.sobject;
    },
    reloadAll() {
      sobjectAllDescribes = initialState();
      didUpdate();
    }
  };
}

