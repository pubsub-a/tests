export const randomString = function (length: number) {
    length = length || 8;
    let text = '';
    const allowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++)
        text += allowedCharacters.charAt(Math.floor(Math.random() * allowedCharacters.length));

    return text;
};

export const randomValidChannelOrTopicName = function (length?: number) {
    if (!length)
        length = Math.ceil(Math.random() * 63);
    let text = '';
    const allowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:_/-';

    for (let i = 0; i < length; i++)
        text += allowedCharacters.charAt(Math.floor(Math.random() * allowedCharacters.length));

    return text;
};
