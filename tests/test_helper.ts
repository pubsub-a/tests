var randomString = function(length) {
  length = length || 8;
  var text = '';
  var allowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for(var i=0; i < length; i++)
    text += allowedCharacters.charAt(Math.floor(Math.random() * allowedCharacters.length));

  return text;
};

var randomValidChannelOrTopicName = <any>function(length) {
  if(!length)
    length = Math.ceil(Math.random() * 63);
  var text = '';
  var allowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:_/-';

  for(var i=0; i < length; i++)
    text += allowedCharacters.charAt(Math.floor(Math.random() * allowedCharacters.length));

  return text;
};

if (typeof window === "undefined") {
    module.exports = {
        randomString: randomString,
        randomValidChannelOrTopicName: randomValidChannelOrTopicName
    };
}
