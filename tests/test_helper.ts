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

const getRandomInt = (min: number, max: number) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

export function deferMs(min: number = 0, max: number = 10000): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(resolve, getRandomInt(min, max))
    })
}

// large random strings are slow as we wait for entropy; for this case we just garbage
// data to test stuff
const rs = randomString(1024);
export function getRandomKilobytes(kilobytes: number) {
    let str = "";
    let i = 1;
    while (i <= kilobytes) {
        str += rs;
        i++;
    }
    return str;
}
