const Babel = require('babel-core')

module.exports = [
  {ext: '.js', transform: (content, filename) => {
    // Make sure to only transform your code or the dependencies you want
    if (filename.indexOf('node_modules') === -1) {
      const result = Babel.transform(content, { sourceMap: 'inline', filename: filename, sourceFileName: filename })
      return result.code
    }
    return content
  }}
]
