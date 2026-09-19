const { exec } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'pythainlp-helper.py');

const NLP = {
  processWord: (word) => {
    return new Promise((resolve, reject) => {
      // สั่งรันคำสั่ง: python pythainlp-helper.py "คำศัพท์"
      exec(`python "${scriptPath}" "${word}"`, (error, stdout, stderr) => {
        if (error) {
          console.error("NLP Error:", stderr);
          return reject(error);
        }
        
        try {
          // แปลง JSON string ที่ Python print ออกมา ให้กลายเป็น Object
          const result = JSON.parse(stdout.trim());
          resolve(result); 
          // จะได้ { word: 'แมว', isNoun: true, syllables: ['แมว'] }
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }
};

module.exports = NLP;