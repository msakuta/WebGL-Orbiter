use super::{CelestialBody, CelestialBodyEntry, CelestialId};
use std::{collections::HashSet, marker::PhantomData};

#[derive(Debug)]
pub struct CelestialBodyComb<'a> {
    slice: *mut [CelestialBodyEntry],
    picked: HashSet<usize>,
    _mark: PhantomData<&'a mut CelestialBodyEntry>,
}

impl<'a> CelestialBodyComb<'a> {
    pub fn new_all(source: &'a mut [CelestialBodyEntry]) -> Self {
        Self {
            slice: source,
            picked: HashSet::new(),
            _mark: PhantomData,
        }
    }

    pub fn new(
        source: &'a mut [CelestialBodyEntry],
        pick: usize,
    ) -> anyhow::Result<(&'a mut CelestialBodyEntry, Self)> {
        let mut picked = HashSet::new();
        picked.insert(pick);
        let slice: *mut [CelestialBodyEntry] = source;
        Ok((
            &mut source[pick],
            Self {
                slice,
                picked,
                _mark: PhantomData,
            },
        ))
    }

    #[allow(dead_code)]
    pub(crate) fn exclude(&mut self, idx: usize) -> anyhow::Result<&mut CelestialBodyEntry> {
        if self.picked.contains(&idx) {
            return Err(anyhow::anyhow!("Index {} already mutably borrowed", idx));
        }

        self.picked.insert(idx);
        Ok(unsafe { &mut (*self.slice)[idx] })
    }

    pub fn exclude_id<'b>(
        &'b mut self,
        id: CelestialId,
    ) -> anyhow::Result<(Option<&'b mut CelestialBody>, CelestialBodyComb<'b>)>
    where
        'a: 'b,
    {
        let idx = id.id as usize;
        if self.picked.contains(&idx) {
            return Err(anyhow::anyhow!("Index {} already mutably borrowed", idx));
        }

        let entry = unsafe { &mut (*self.slice)[idx] };
        if entry.gen != id.gen || entry.dynamic.is_none() {
            Err(anyhow::anyhow!(
                "The generation has changed; the object is likely to be destroyed"
            ))
        } else {
            let mut picked = self.picked.clone();
            picked.insert(idx);
            return Ok((
                entry.dynamic.as_mut(),
                CelestialBodyComb {
                    slice: self.slice,
                    picked,
                    _mark: PhantomData,
                },
            ));
        }
    }

    /// Accessor without generation checking.
    #[allow(dead_code)]
    pub(crate) fn get_at(&self, idx: usize) -> Option<&CelestialBodyEntry> {
        if self.picked.contains(&idx) {
            None
        } else {
            Some(unsafe { &(*self.slice)[idx] })
        }
    }

    /// Mutable accessor without generation checking.
    #[allow(dead_code)]
    pub(crate) fn get_at_mut(&mut self, idx: usize) -> Option<&mut CelestialBodyEntry> {
        if self.picked.contains(&idx) {
            None
        } else {
            Some(unsafe { &mut (*self.slice)[idx] })
        }
    }

    /// Accessor with generation checking.
    #[allow(dead_code)]
    pub fn get(&self, id: CelestialId) -> Option<&CelestialBody> {
        let idx = id.id as usize;
        if self.picked.contains(&idx) {
            return None;
        }
        let entry = unsafe { &(*self.slice)[idx] };
        if entry.gen == entry.gen {
            entry.dynamic.as_ref()
        } else {
            None
        }
    }

    /// Mutable accessor with generation checking.
    pub(crate) fn get_mut(&mut self, id: CelestialId) -> Option<&mut CelestialBody> {
        let idx = id.id as usize;
        if self.picked.contains(&idx) {
            return None;
        }
        let entry = unsafe { &mut (*self.slice)[idx] };
        if entry.gen == entry.gen {
            entry.dynamic.as_mut()
        } else {
            None
        }
    }
}

pub struct CelestialBodyImComb<'a> {
    slice: *const [CelestialBodyEntry],
    picked: HashSet<usize>,
    _mark: PhantomData<&'a CelestialBodyEntry>,
}

impl<'a> CelestialBodyImComb<'a> {
    pub fn new_all(source: &'a [CelestialBodyEntry]) -> Self {
        Self {
            slice: source,
            picked: HashSet::new(),
            _mark: PhantomData,
        }
    }

    pub fn new(
        source: &'a [CelestialBodyEntry],
        pick: usize,
    ) -> anyhow::Result<(&'a CelestialBodyEntry, Self)> {
        let mut picked = HashSet::new();
        picked.insert(pick);
        let slice: *const [CelestialBodyEntry] = source;
        Ok((
            &source[pick],
            Self {
                slice,
                picked,
                _mark: PhantomData,
            },
        ))
    }

    #[allow(dead_code)]
    pub(crate) fn exclude(&mut self, idx: usize) -> anyhow::Result<&CelestialBodyEntry> {
        if self.picked.contains(&idx) {
            return Err(anyhow::anyhow!("Index {} already mutably borrowed", idx));
        }

        self.picked.insert(idx);
        Ok(unsafe { &(*self.slice)[idx] })
    }

    pub fn exclude_id<'b>(
        &'b mut self,
        id: CelestialId,
    ) -> anyhow::Result<(Option<&'b CelestialBody>, CelestialBodyImComb<'b>)>
    where
        'a: 'b,
    {
        let idx = id.id as usize;
        if self.picked.contains(&idx) {
            return Err(anyhow::anyhow!("Index {} already mutably borrowed", idx));
        }

        let entry = unsafe { &(*self.slice)[idx] };
        if entry.gen != id.gen || entry.dynamic.is_none() {
            Err(anyhow::anyhow!(
                "The generation has changed; the object is likely to be destroyed"
            ))
        } else {
            let mut picked = self.picked.clone();
            picked.insert(idx);
            return Ok((
                entry.dynamic.as_ref(),
                CelestialBodyImComb {
                    slice: self.slice,
                    picked,
                    _mark: PhantomData,
                },
            ));
        }
    }

    /// Accessor without generation checking.
    #[allow(dead_code)]
    pub(crate) fn get_at(&self, idx: usize) -> Option<&CelestialBodyEntry> {
        if self.picked.contains(&idx) {
            None
        } else {
            Some(unsafe { &(*self.slice)[idx] })
        }
    }

    /// Accessor with generation checking.
    #[allow(dead_code)]
    pub fn get(&self, id: CelestialId) -> Option<&CelestialBody> {
        let idx = id.id as usize;
        if self.picked.contains(&idx) {
            return None;
        }
        let entry = unsafe { &(*self.slice)[idx] };
        if entry.gen == entry.gen {
            entry.dynamic.as_ref()
        } else {
            None
        }
    }
}

impl<'a> From<CelestialBodyComb<'a>> for CelestialBodyImComb<'a> {
    fn from(o: CelestialBodyComb<'a>) -> Self {
        Self {
            slice: o.slice,
            picked: o.picked.clone(),
            _mark: PhantomData,
        }
    }
}

impl<'a> From<&CelestialBodyComb<'a>> for CelestialBodyImComb<'a> {
    fn from(o: &CelestialBodyComb<'a>) -> Self {
        Self {
            slice: o.slice,
            picked: o.picked.clone(),
            _mark: PhantomData,
        }
    }
}
