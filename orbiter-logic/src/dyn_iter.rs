use std::iter;

pub(crate) trait DynIter {
    type Item: ?Sized;
    fn dyn_iter(&self) -> Box<dyn Iterator<Item = &Self::Item> + '_>;
    fn as_dyn_iter(&self) -> &dyn DynIter<Item = Self::Item>;
}
impl<T, Item> DynIter for T
where
    for<'a> &'a T: IntoIterator<Item = &'a Item>,
{
    type Item = Item;
    fn dyn_iter(&self) -> Box<dyn Iterator<Item = &Self::Item> + '_> {
        Box::new(self.into_iter())
    }
    fn as_dyn_iter(&self) -> &dyn DynIter<Item = Self::Item> {
        self
    }
}

pub(crate) trait DynIterMut: DynIter {
    fn dyn_iter_mut(&mut self) -> Box<dyn Iterator<Item = &mut Self::Item> + '_>;
}
impl<T, Item> DynIterMut for T
where
    for<'a> &'a T: IntoIterator<Item = &'a Item>,
    for<'a> &'a mut T: IntoIterator<Item = &'a mut Item>,
{
    fn dyn_iter_mut(&mut self) -> Box<dyn Iterator<Item = &mut Self::Item> + '_> {
        Box::new(self.into_iter())
    }
}

pub(crate) struct MutRef<'r, T: ?Sized>(pub &'r mut T);
impl<'a, 'r, T: ?Sized> IntoIterator for &'a MutRef<'r, T>
where
    &'a T: IntoIterator,
{
    type IntoIter = <&'a T as IntoIterator>::IntoIter;
    type Item = <&'a T as IntoIterator>::Item;
    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl<'a, 'r, T: ?Sized> IntoIterator for &'a mut MutRef<'r, T>
where
    &'a mut T: IntoIterator,
{
    type IntoIter = <&'a mut T as IntoIterator>::IntoIter;
    type Item = <&'a mut T as IntoIterator>::Item;
    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}

pub(crate) struct Ref<'r, T: ?Sized>(pub &'r T);
impl<'a, 'r, T: ?Sized> IntoIterator for &'a Ref<'r, T>
where
    &'a T: IntoIterator,
{
    type IntoIter = <&'a T as IntoIterator>::IntoIter;
    type Item = <&'a T as IntoIterator>::Item;
    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}

pub(crate) struct Chained<S, T>(pub S, pub T);
impl<'a, S, T, Item: 'a> IntoIterator for &'a Chained<S, T>
where
    &'a S: IntoIterator<Item = &'a Item>,
    &'a T: IntoIterator<Item = &'a Item>,
{
    type IntoIter =
        iter::Chain<<&'a S as IntoIterator>::IntoIter, <&'a T as IntoIterator>::IntoIter>;
    type Item = &'a Item;
    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter().chain(self.1.into_iter())
    }
}
impl<'a, S, T, Item: 'a> IntoIterator for &'a mut Chained<S, T>
where
    &'a mut S: IntoIterator<Item = &'a mut Item>,
    &'a mut T: IntoIterator<Item = &'a mut Item>,
{
    type IntoIter =
        iter::Chain<<&'a mut S as IntoIterator>::IntoIter, <&'a mut T as IntoIterator>::IntoIter>;
    type Item = &'a mut Item;
    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter().chain(self.1.into_iter())
    }
}

#[test]
fn test_dyn_iter() {
    let v = vec![0, 1, 2, 3, 4];

    assert_eq!(v, Ref(&v).dyn_iter().map(|v| *v).collect::<Vec<_>>());
    assert_eq!(
        v,
        MutRef(&mut v.clone())
            .dyn_iter_mut()
            .map(|v| *v)
            .collect::<Vec<_>>()
    );

    let mut v_mut = v.clone();
    for v in MutRef(&mut v_mut).dyn_iter_mut() {
        *v = -*v;
    }

    for (v, v2) in v.iter().zip(v_mut.iter()) {
        assert_eq!(*v, -*v2);
    }

    let mut v_mut = v.clone();
    let (first, mid) = v_mut.split_at_mut(2);
    let (center, last) = mid.split_first_mut().unwrap();
    let mut chained = Chained(MutRef(first), MutRef(last));
    assert_eq!(
        vec![0, 1, 3, 4],
        chained.dyn_iter().map(|v| *v).collect::<Vec<_>>()
    );
    assert_eq!(
        vec![0, 1, 3, 4],
        chained.dyn_iter_mut().map(|v| *v).collect::<Vec<_>>()
    );
    assert_eq!(
        vec![0, 1, 3, 4],
        chained.dyn_iter_mut().map(|v| *v).collect::<Vec<_>>()
    );
}
