/*=========================================================
 ranAI Utilities v2.0
 Author: Abhimanyu
=========================================================*/

"use strict";

/*---------------------------------------------------------
 Text Normalization
---------------------------------------------------------*/

function normalizeText(text) {

    if (!text) return "";

    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ");

}

/*---------------------------------------------------------
 Remove Duplicate Words
---------------------------------------------------------*/

function uniqueWords(words) {

    return [...new Set(words)];

}

/*---------------------------------------------------------
 Split Sentence
---------------------------------------------------------*/

function tokenize(text) {

    return normalizeText(text).split(" ");

}

/*---------------------------------------------------------
 Similarity Score
---------------------------------------------------------*/

function similarityScore(input, keyword) {

    input = normalizeText(input);
    keyword = normalizeText(keyword);

    let score = 0;

    const inputWords = tokenize(input);
    const keywordWords = tokenize(keyword);

    keywordWords.forEach(word => {

        if (inputWords.includes(word))
            score++;

    });

    return score;

}

/*---------------------------------------------------------
 Exact Match
---------------------------------------------------------*/

function exactMatch(input, keywords) {

    input = normalizeText(input);

    for (let word of keywords) {

        if (input === normalizeText(word))
            return true;

    }

    return false;

}

/*---------------------------------------------------------
 Partial Match
---------------------------------------------------------*/

function partialMatch(input, keywords) {

    input = normalizeText(input);

    for (let word of keywords) {

        if (input.includes(normalizeText(word)))
            return true;

    }

    return false;

}

/*---------------------------------------------------------
 Find Best Match
---------------------------------------------------------*/

function bestKeywordMatch(input, database) {

    let best = null;
    let highestScore = 0;

    database.forEach(entry => {

        entry.keywords.forEach(keyword => {

            const score = similarityScore(input, keyword);

            if (score > highestScore) {

                highestScore = score;
                best = entry;

            }

        });

    });

    return {

        score: highestScore,
        result: best

    };

}

/*---------------------------------------------------------
 Random Response
---------------------------------------------------------*/

function randomResponse(responses) {

    if (!Array.isArray(responses))
        return responses;

    return responses[
        Math.floor(Math.random() * responses.length)
    ];

}
/*---------------------------------------------------------
 Common Synonyms
---------------------------------------------------------*/

const RANAI_SYNONYMS = {

hello:[
"hi",
"hey",
"hii",
"helo",
"yo",
"sup",
"greetings"
],

bye:[
"goodbye",
"see you",
"cya",
"later"
],

thanks:[
"thank you",
"thx",
"ty",
"thanks"
],

html:[
"hypertext markup language"
],

css:[
"stylesheet",
"style sheet"
],

javascript:[
"js"
],

python:[
"py"
],

artificialintelligence:[
"ai"
],

machinelearning:[
"ml"
]

};

/*---------------------------------------------------------
 Expand Synonyms
---------------------------------------------------------*/

function expandSynonyms(input){

input = normalizeText(input);

Object.keys(RANAI_SYNONYMS).forEach(main=>{

RANAI_SYNONYMS[main].forEach(word=>{

if(input.includes(word))
input += " " + main;

});

});

return input;

}

/*---------------------------------------------------------
 Smart Normalize
---------------------------------------------------------*/

function preprocess(text){

text = normalizeText(text);

text = expandSynonyms(text);

return text;

}
