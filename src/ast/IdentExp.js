module.exports = {
	props: ['id'],
	eval(x)
	{
		return x.scope[this.id];
	}
};