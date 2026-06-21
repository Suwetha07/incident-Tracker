from celery import Celery

app = Celery(broker="redis://redis:6379/0", backend="redis://redis:6379/1")


@app.task
def noop():
    return "noop"
