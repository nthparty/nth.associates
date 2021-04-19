class Progress:
    def __init__(self, stages=100):
        self._status = 0
        self.stages = stages

    # mr4mp progress hook
    def hook(self, xs):
        self._status = self._status + 1 % self.stages
        return xs

    def __repr__(self):
        return str(round(self._status*100.0/self.stages, 2))

    def __str__(self):
        return repr(self)

    def reset(self):
        self = self.__init__(self.stages)
        return self
