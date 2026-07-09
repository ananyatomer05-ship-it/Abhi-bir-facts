/*=========================================================
    ranAI Search Engine v1.0
=========================================================*/

"use strict";

function ranAISearch(question){

    if(!question)
        return null;

    question = preprocess(question);

    let bestEntry = null;
    let bestScore = 0;

    for(const entry of RANAI_DATABASE){

        let score = 0;

        for(const keyword of entry.keywords){

            const keywordText = preprocess(keyword);

            if(question === keywordText){

                score += 100;

            }

            if(question.includes(keywordText)){

                score += 50;

            }

            score += similarityScore(question, keywordText);

        }

        if(score > bestScore){

            bestScore = score;
            bestEntry = entry;

        }

    }

    if(bestEntry){

        const answer = randomResponse(bestEntry.responses);

        remember(
            question,
            answer,
            bestEntry.category
        );

        return{

            found:true,

            answer:answer,

            category:bestEntry.category,

            score:bestScore

        };

    }

    return{

        found:false,

        answer:"Sorry, I don't know that yet.",

        category:"unknown",

        score:0

    };

}
/*=========================================================
    Ask ranAI
=========================================================*/

function askRanAI(question){

    const result = ranAISearch(question);

    return result.answer;

}
