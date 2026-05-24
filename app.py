from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/emf')
def emf():
    return render_template('emf.html')

@app.route('/mmf')
def mmf():
    return render_template('mmf.html')

@app.route('/zpf')
def zpf():
    return render_template('zpf.html')

@app.route('/motor')
def motor():
    return render_template('motor.html')

@app.route('/quiz')
def quiz():
    return render_template('quiz.html')

@app.route('/report')
def report():
    return render_template('report.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

if __name__ == '__main__':
    app.run(debug=True, port=5001)
