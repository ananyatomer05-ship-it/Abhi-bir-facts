/*=========================================================
    ranAI Memory System v1.0
=========================================================*/

"use strict";

const RanAIMemory = {

    userName: "",

    previousQuestion: "",

    previousAnswer: "",

    lastTopic: "",

    currentCategory: "",

    questionCount: 0,

    sessionStarted: Date.now(),

    history: []

};

/*---------------------------------------------------------
 Save Conversation
---------------------------------------------------------*/

function remember(question, answer, category = "") {

    RanAIMemory.previousQuestion = question;

    RanAIMemory.previousAnswer = answer;

    RanAIMemory.lastTopic = category;

    RanAIMemory.questionCount++;

    RanAIMemory.history.push({

        question,

        answer,

        category,

        time: new Date().toLocaleTimeString()

    });

    if (RanAIMemory.history.length > 50)
        RanAIMemory.history.shift();

}

/*---------------------------------------------------------
 User Name
---------------------------------------------------------*/

function setUserName(name) {

    RanAIMemory.userName = name.trim();

}

function getUserName() {

    return RanAIMemory.userName;

}

/*---------------------------------------------------------
 Previous Question
---------------------------------------------------------*/

function lastQuestion() {

    return RanAIMemory.previousQuestion;

}

/*---------------------------------------------------------
 Previous Answer
---------------------------------------------------------*/

function lastAnswer() {

    return RanAIMemory.previousAnswer;

}

/*---------------------------------------------------------
 Last Topic
---------------------------------------------------------*/

function lastTopic() {

    return RanAIMemory.lastTopic;

}

/*---------------------------------------------------------
 Conversation Count
---------------------------------------------------------*/

function totalQuestions() {

    return RanAIMemory.questionCount;

}

/*---------------------------------------------------------
 History
---------------------------------------------------------*/

function getHistory() {

    return RanAIMemory.history;

}

/*---------------------------------------------------------
 Clear Memory
---------------------------------------------------------*/

function clearMemory() {

    RanAIMemory.userName = "";

    RanAIMemory.previousQuestion = "";

    RanAIMemory.previousAnswer = "";

    RanAIMemory.lastTopic = "";

    RanAIMemory.currentCategory = "";

    RanAIMemory.questionCount = 0;

    RanAIMemory.history = [];

}

/*---------------------------------------------------------
 Session Time
---------------------------------------------------------*/

function sessionDuration() {

    return Math.floor(

        (Date.now() - RanAIMemory.sessionStarted) / 1000

    );

}
