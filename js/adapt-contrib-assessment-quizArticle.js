define(function(require) {

    var Adapt = require('coreJS/adapt');

    var AssessmentView = Backbone.View.extend({

        className: "extension-assessment display-none",

        events: {
            'click a.button.review': 'onReviewClicked',
            'click a.button.retake': 'onRetakeClicked'
        },

        initialize: function() {
            this.listenTo(this.model, 'change:_isComplete', this.assessmentComplete);
            this.listenTo(Adapt, 'remove', this.removeAssessment);
            this.listenTo(Adapt, 'assessment:complete', function() {
                this.listenTo(Adapt, 'tutor:closed', this.onTutorClosed);
            });
            this.setUpQuiz();
            this.render();
        },

        render: function() {
            var template = Handlebars.templates["reviewRetake"];
            this.$el.html(template()).appendTo('body');
            return this;
        },

        onTutorClosed: function() {
            this.$el.removeClass('display-none');
        },

        onReviewClicked: function(event) {
            event.preventDefault();
            this.$el.addClass('display-none');
            $.scrollTo(0, 0);
        },

        onRetakeClicked: function(event) {
            event.preventDefault();
            this.$el.addClass('display-none');
            $.scrollTo(0, 0);
            this.resetModel();

            var index = document.location.href.indexOf('#/id/');
            var route = document.location.href.slice(index, document.location.href.length);
            Backbone.history.navigate(route, {trigger: true});
        },

        resetModel: function() {
            _.each(this.getQuestionComponents(), function(component) {
                component.set('_attemptsLeft', component.get('_attempts'));
                component.set('_isComplete', false);
                component.set('_isEnabled', true);
                component.set('_isSubmitted', false);
                component.set('_selectedItems', []);
                component.set('_userAnswer', []);

                component.unset('_isAtLeastOneCorrectSelection');
                component.unset('_isCorrect');
                component.unset('_numberOfCorrectAnswers');
                component.unset('_score');
                component.unset('feedbackMessage');
            });

            this.model.unset('feedbackMessage');
            this.model.unset('feedbackTitle');
            this.model.unset('score');

            this.model.setOnChildren('_isComplete', false);
            this.model.set('_isComplete', false);
        },

        getQuestionComponents: function() {
            var childComponents = this.model.findDescendants('components');

            // Although we retrieve all decendants of the article, regarding the assessment
            // we are only interested in questions.  Currently we check for a
            // _questionWeight attribute
            return _.filter(childComponents.models, function(component) { 
                if (component.get('_questionWeight')) {
                    return component;
                } 
            });
        },

        assessmentComplete: function() { 
            function notComplete(model) {
                return !model.get('_isComplete');
            }

            if(notComplete(this.model) || _.some(this.getQuestionComponents(), notComplete)) return;
            
            var isPercentageBased = this.model.get('_assessment')._isPercentageBased;
            var scoreToPass = this.model.get('_assessment')._scoreToPass;
            var score = this.getScore();
            var scoreAsPercent = this.getScoreAsPercent();
            var isPass = false;
            this.setFeedbackMessage();
            this.model.set({
                'feedbackTitle': this.model.get('_assessment')._completionMessage.title, 
                'score': isPercentageBased ? scoreAsPercent + '%' : score
            });
            Adapt.trigger('questionView:showFeedback', this);

            if (isPercentageBased) {
                isPass = (scoreAsPercent >= scoreToPass) ? true : false; 
            } else {
                isPass = (score >= scoreToPass) ? true : false;
            }

            Adapt.trigger('assessment:complete', {isPass: isPass, score: score, scoreAsPercent: scoreAsPercent});
        },

        setFeedbackMessage: function() {
            var feedback = (this.model.get('_assessment')._completionMessage.message);

            feedback = feedback.replace("[SCORE]", this.getScore());
            feedback = feedback.replace("[MAXSCORE]", this.getMaxScore().toString());
            feedback = feedback.replace("[PERCENT]", this.getScoreAsPercent().toString());
            feedback = feedback.replace("[FEEDBACK]", this.getBandedFeedback().toString());

            this.model.set('feedbackMessage', feedback);
        },

        setUpQuiz: function() {
            this.model.get('_assessment').score = 0;
            $('.' + this.model.get('_id')).addClass('assessment');
            _.each(this.getQuestionComponents(), function(component) {
                component.set({'_isEnabledOnRevisit': false, '_canShowFeedback': false}, {pluginName: "_assessment"});
            });
        },
        
        getScore: function() {
            var score = 0;

            _.each(this.getQuestionComponents(), function(component) {
                if (component.get('_isCorrect') && component.get('_score')) {
                    score += component.get('_score');   
                }
            });

            return score;
        },
        
        getMaxScore: function() {
            var maxScore = 0;

            _.each(this.getQuestionComponents(), function(component) {
                if (component.get('_questionWeight')) {
                    maxScore += component.get('_questionWeight');
                }
            });

            return maxScore;
        },
        
        getScoreAsPercent: function() {
            return Math.round((this.getScore() / this.getMaxScore()) * 100);
        },    
        
        resetQuiz: function() {
            this.model.set('_assessment').numberOfAnsweredQuestions = 0;
            this.model.set('_assessment').score = 0;
        },
        
        getBandedFeedback: function() {
            var bands = this.model.get('_assessment')._bands;
            var percent = this.getScoreAsPercent();
            
            for (var i = (bands.length - 1); i >= 0; i--) {
                if (percent >= bands[i]._score) {
                    return bands[i].feedback;
                }
            }
        },

        removeAssessment: function() {
            this.remove();
        }
        
    });

    Adapt.on('articleView:postRender', function(view) {
        if (view.model.get('_assessment') && view.model.get('_assessment')._isEnabled) {
            new AssessmentView({model:view.model});
        }
    });

});