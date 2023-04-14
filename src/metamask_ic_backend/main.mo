import Debug "mo:base/Debug";

actor {
  public shared(msg) func greet(name : Text) : async Text {
    Debug.print(debug_show(msg.caller));
    return "Hello, " # name # "!";
  };
};
