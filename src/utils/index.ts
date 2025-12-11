


export function createPageUrl(pageName: string) {
    // Split path and query string to preserve query parameter case
    const [path, queryString] = pageName.split('?');
    const lowercasePath = path.toLowerCase().replace(/ /g, '-');
    
    if (queryString) {
        return '/' + lowercasePath + '?' + queryString;
    }
    return '/' + lowercasePath;
}